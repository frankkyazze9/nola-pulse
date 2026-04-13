#!/bin/bash
set -euo pipefail

# Dark Horse — GCP Infrastructure Setup
# Run once to set up the GCP project infrastructure.
# NOTE: Most of this was already run during the Nola Pulse era.
# The bootstrap for Dark Horse is documented in docs/deploy.md.

PROJECT_ID="nola-ai-innovation"
REGION="us-south1"
SERVICE_NAME="dark-horse"
DB_INSTANCE="nola-pulse-db"
DB_NAME="nolapulse"
DB_USER="nolapulse"
ARTIFACT_REPO="dark-horse-repo"

echo "=== Dark Horse GCP Setup ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Enable required APIs
echo "Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  --project=$PROJECT_ID

# Create Artifact Registry repo
echo "Creating Artifact Registry repo..."
gcloud artifacts repositories create $ARTIFACT_REPO \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Repo already exists"

# Create Cloud SQL instance
echo "Creating Cloud SQL instance..."
gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Instance already exists"

# Create database
echo "Creating database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Database already exists"

# Create database user
echo "Creating database user..."
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE \
  --password="$DB_PASSWORD" \
  --project=$PROJECT_ID \
  2>/dev/null || echo "User already exists"

# Get Cloud SQL connection name
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE \
  --project=$PROJECT_ID \
  --format='value(connectionName)')

# Create secrets
echo "Creating secrets..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL \
  --data-file=- --project=$PROJECT_ID \
  2>/dev/null || echo "Secret DATABASE_URL already exists"

echo -n "$(openssl rand -base64 32)" | gcloud secrets create CRON_SECRET \
  --data-file=- --project=$PROJECT_ID \
  2>/dev/null || echo "Secret CRON_SECRET already exists"

# Note: ANTHROPIC_API_KEY must be set manually
echo ""
echo "IMPORTANT: Set your Anthropic API key:"
echo "  echo -n 'sk-ant-...' | gcloud secrets create ANTHROPIC_API_KEY --data-file=- --project=$PROJECT_ID"

# Create Cloud Scheduler jobs
echo "Creating Cloud Scheduler jobs..."

# Get the Cloud Run URL (will exist after first deploy)
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
  CRON_SECRET=$(gcloud secrets versions access latest --secret=CRON_SECRET --project=$PROJECT_ID)

  # Nightly scraper run (RSS + GDELT)
  gcloud scheduler jobs create http nightly-scrapers \
    --location=$REGION \
    --schedule="0 5 * * *" \
    --uri="${SERVICE_URL}/api/jobs/scrapers" \
    --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}" \
    --project=$PROJECT_ID \
    2>/dev/null || echo "Job nightly-scrapers already exists"

  echo "Cloud Scheduler jobs created."
else
  echo "Cloud Run service not yet deployed. Run Cloud Scheduler setup after first deploy."
fi

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Set ANTHROPIC_API_KEY secret (see above)"
echo "  2. Build and deploy: gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID"
echo "  3. Run database migrations: npx prisma migrate deploy"
echo "  4. Seed the database: npx prisma db seed"
echo "  5. Set up Cloud Scheduler jobs (if not done above)"
echo "  6. Enable IAP and grant access (see docs/deploy.md steps 8-9)"
