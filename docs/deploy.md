# Dark Horse deployment

Dark Horse runs on Google Cloud Run in the `nola-ai-innovation` project, region `us-south1`. Cloud Build watches the `main` branch; every push to `main` triggers a build + deploy via `cloudbuild.yaml`.

This doc covers the one-time bootstrap and the day-to-day operations.

## First-time bootstrap

These steps run **once** when you're standing up Dark Horse from the Nola Pulse base. Some are manual (gcloud / console) because they provision infrastructure the app depends on.

**Status as of 2026-04-11:** Steps 1-6 are DONE. Steps 7-8 (IAP) are pending. Step 9 is DONE. Step 10 is pending confirmation.

### 1. Create the Artifact Registry repo -- DONE

```bash
gcloud artifacts repositories create dark-horse-repo \
  --repository-format=docker \
  --location=us-south1 \
  --description="Dark Horse container images" \
  --project=nola-ai-innovation
```

### 2. Create the GCS bucket -- DONE

```bash
gcloud storage buckets create gs://dark-horse-docs \
  --project=nola-ai-innovation \
  --location=us-south1 \
  --uniform-bucket-level-access

# Lifecycle: move objects to Coldline after 90 days
gcloud storage buckets update gs://dark-horse-docs \
  --lifecycle-file=<(cat <<'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90, "matchesStorageClass": ["STANDARD"]}
      }
    ]
  }
}
EOF
)
```

### 3. Create the Document AI OCR processor -- DONE

```bash
gcloud documentai processors create \
  --location=us \
  --display-name="dark-horse-ocr" \
  --type=OCR_PROCESSOR \
  --project=nola-ai-innovation
```

Processor ID: `projects/845570509325/locations/us/processors/5af64dddbe7314c0`

### 4. Start Cloud SQL + run migration + seed -- DONE

Cloud SQL instance `nola-pulse-db` (db-f1-micro) was already provisioned. Migration and seed were applied:

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 5. Deploy `dark-horse` and `dark-horse-embed` services -- DONE

Main app deployed with `--no-allow-unauthenticated`:
- URL: `https://dark-horse-lo7wkq5zya-vp.a.run.app`

Embedding service (`dark-horse-embed`) deploying as a private Cloud Run service (BGE-small-en-v1.5, 384 dim). See `pipelines/embed/` for the container.

### 6. Set the Document AI processor env var -- DONE

```bash
gcloud run services update dark-horse \
  --region=us-south1 \
  --update-env-vars=DOCUMENT_AI_PROCESSOR_ID="projects/845570509325/locations/us/processors/5af64dddbe7314c0"
```

### 7. Delete stale Nola Pulse secrets -- PENDING

The following secrets are no longer used by Dark Horse and can be removed from Secret Manager after the deployment is confirmed stable:

```bash
gcloud secrets delete ADMIN_PASSWORD --project=nola-ai-innovation
gcloud secrets delete AUTH_SECRET --project=nola-ai-innovation
gcloud secrets delete NEXTAUTH_URL --project=nola-ai-innovation
gcloud secrets delete AUTH_TRUST_HOST --project=nola-ai-innovation
gcloud secrets delete GOOGLE_CLIENT_ID --project=nola-ai-innovation
gcloud secrets delete GOOGLE_CLIENT_SECRET --project=nola-ai-innovation
gcloud secrets delete ADMIN_EMAILS --project=nola-ai-innovation
```

Keep: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`.

### 8. Enable IAP on the `dark-horse` service -- PENDING

Console path: **Security -> Identity-Aware Proxy -> HTTPS Resources -> dark-horse**, toggle on.

CLI path:
```bash
gcloud iap settings set settings.yaml \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1
```

### 9. Grant access to users -- PENDING (blocked on step 8)

```bash
# Admin
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:admin@example.com \
  --role=roles/iap.httpsResourceAccessor

# Team member
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:<team-member-email> \
  --role=roles/iap.httpsResourceAccessor
```

Add more Dark Horse team members the same way.

### 10. Decommission `nola-pulse` -- PENDING

Once `dark-horse` is stable and confirmed, delete the old service:

```bash
gcloud run services delete nola-pulse --region=us-south1 --project=nola-ai-innovation
```

The old Artifact Registry repo (`nola-pulse-repo`) can be deleted later -- keep it for a week as a rollback option.

## Day-to-day

### Deploy
Just push to `main`. Cloud Build handles the rest.

Manual deploy:
```bash
gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation
```

### Grant access to a new team member
```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:<email> \
  --role=roles/iap.httpsResourceAccessor
```

### Revoke access
```bash
gcloud iap web remove-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:<email> \
  --role=roles/iap.httpsResourceAccessor
```

### Tail logs
```bash
gcloud run services logs tail dark-horse --region=us-south1
```

### Roll back
```bash
# List revisions
gcloud run revisions list --service=dark-horse --region=us-south1

# Route traffic to a prior revision
gcloud run services update-traffic dark-horse \
  --region=us-south1 \
  --to-revisions=<revision-name>=100
```

## Secrets

All secrets live in Google Secret Manager in the `nola-ai-innovation` project (845570509325).

| Secret | Purpose | Where to rotate |
|---|---|---|
| `DATABASE_URL` | Cloud SQL connection (instance: `nola-pulse-db`, db: `nolapulse`) | Cloud SQL connection string -> update Secret Manager |
| `ANTHROPIC_API_KEY` | Claude API | console.anthropic.com -> generate new -> update Secret Manager |
| `CRON_SECRET` | Shared secret for Cloud Scheduler -> `/api/jobs/*` | `openssl rand -hex 32` -> update Secret Manager |
| `TWITTER_API_KEY` | Twitter/X API key (legacy; migrating to SociaVault) | developer.twitter.com -> update Secret Manager |
| `TWITTER_API_SECRET` | Twitter/X API secret | (same) |
| `TWITTER_ACCESS_TOKEN` | Twitter/X access token | (same) |
| `TWITTER_ACCESS_SECRET` | Twitter/X access secret | (same) |

**Stale secrets (safe to delete):** `ADMIN_PASSWORD`, `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`. See bootstrap step 7 for cleanup commands.

Non-secret env vars (set via `--set-env-vars` in `cloudbuild.yaml`):
- `GCP_PROJECT_ID` -- resolved to Cloud Build substitution `$PROJECT_ID`
- `GCS_BUCKET` -- `dark-horse-docs`

Env vars added manually after bootstrap:
- `DOCUMENT_AI_PROCESSOR_ID` -- `projects/845570509325/locations/us/processors/5af64dddbe7314c0` (set in step 6)
- `EMBEDDING_SERVICE_URL` -- internal URL of the `dark-horse-embed` Cloud Run service

## Costs

See `.claude/skills/cost-discipline/SKILL.md` for the $100/mo ceiling rules and cost levers. The `/admin/spend` page shows month-to-date spend and per-service breakdown.
