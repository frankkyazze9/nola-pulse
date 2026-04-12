# Dark Horse deployment

Dark Horse runs on Google Cloud Run in the `nola-ai-innovation` project, region `us-south1`. Cloud Build watches the `main` branch; every push to `main` triggers a build + deploy via `cloudbuild.yaml`.

This doc covers the one-time bootstrap and the day-to-day operations.

## First-time bootstrap

These steps run **once** when you're standing up Dark Horse from the Nola Pulse base. Some are manual (gcloud / console) because they provision infrastructure the app depends on.

### 1. Create the Artifact Registry repo

```bash
gcloud artifacts repositories create dark-horse-repo \
  --repository-format=docker \
  --location=us-south1 \
  --description="Dark Horse container images" \
  --project=nola-ai-innovation
```

### 2. Create the GCS bucket

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

### 3. Create the Document AI OCR processor

```bash
gcloud documentai processors create \
  --location=us \
  --display-name="dark-horse-ocr" \
  --type=OCR_PROCESSOR \
  --project=nola-ai-innovation
```

Note the processor ID from the output and add it as an env var on the Cloud Run service (see step 6).

### 4. Provision the `dark-horse-embed` Cloud Run service

Builds and deploys the self-hosted embedding service (BGE-small-en-v1.5, 384 dim). See `pipelines/embed/` for the container.

```bash
# TODO: build Dockerfile.embed + deploy as a private Cloud Run service
# Target: ~1 GB RAM, scale-to-zero, no public access
```

### 5. Delete stale Nola Pulse secrets

The following secrets are no longer used by Dark Horse and can be removed from Secret Manager after the first Dark Horse deploy succeeds:

```bash
gcloud secrets delete ADMIN_PASSWORD --project=nola-ai-innovation
gcloud secrets delete AUTH_SECRET --project=nola-ai-innovation
```

Keep: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.

### 6. Trigger the first Dark Horse build

```bash
gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation
```

This creates the `dark-horse` Cloud Run service with `--no-allow-unauthenticated`. The service will be unreachable publicly until IAP is enabled in step 7.

### 7. Enable IAP on the `dark-horse` service

Console path: **Security → Identity-Aware Proxy → HTTPS Resources → dark-horse**, toggle on.

CLI path:
```bash
gcloud iap settings set settings.yaml \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1
```

### 8. Grant access to users

```bash
# Frank
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:frankkyazze@gmail.com \
  --role=roles/iap.httpsResourceAccessor

# Christine (Last Word Strategies)
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:<christine-email> \
  --role=roles/iap.httpsResourceAccessor
```

Add more Last Word staff the same way.

### 9. Set the Document AI processor env var

Once the processor from step 3 exists, update the Cloud Run service:

```bash
gcloud run services update dark-horse \
  --region=us-south1 \
  --update-env-vars=DOCUMENT_AI_PROCESSOR_ID="projects/<project-number>/locations/us/processors/<processor-id>"
```

### 10. Decommission `nola-pulse`

Once `dark-horse` is stable and Frank confirms, delete the old service:

```bash
gcloud run services delete nola-pulse --region=us-south1 --project=nola-ai-innovation
```

The old Artifact Registry repo (`nola-pulse-repo`) can be deleted later — keep it for a week as a rollback option.

## Day-to-day

### Deploy
Just push to `main`. Cloud Build handles the rest.

Manual deploy:
```bash
gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation
```

### Grant access to a new Last Word staffer
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

| Secret | Purpose | Where to rotate |
|---|---|---|
| `DATABASE_URL` | Cloud SQL connection | Cloud SQL → connection string → update Secret Manager |
| `ANTHROPIC_API_KEY` | Claude API | console.anthropic.com → generate new → update Secret Manager |
| `CRON_SECRET` | Shared secret for Cloud Scheduler → `/api/jobs/*` | `openssl rand -hex 32` → update Secret Manager |

Non-secret env vars (set via `--set-env-vars` in `cloudbuild.yaml`):
- `GCP_PROJECT_ID` — resolved to Cloud Build substitution `$PROJECT_ID`
- `GCS_BUCKET` — `dark-horse-docs`

Env vars added manually after bootstrap:
- `DOCUMENT_AI_PROCESSOR_ID` — from step 9 above
- `EMBEDDING_SERVICE_URL` — internal URL of the `dark-horse-embed` Cloud Run service

## Costs

See `.claude/skills/cost-discipline/SKILL.md` for the $100/mo ceiling rules and cost levers. The `/admin/spend` page shows month-to-date spend and per-service breakdown.
