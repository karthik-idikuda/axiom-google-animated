terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    firebase = {
      source  = "hashicorp/firebase"
      version = "~> 0.1"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "firebase" {
  credentials = file(var.credentials_file)
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "axiom-conscience"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "credentials_file" {
  description = "Path to GCP service account JSON"
  type        = string
  default     = "~/axiom-sa-key.json"
}

variable "backend_image" {
  description = "Docker image URL for backend"
  type        = string
  default     = "us-central1-docker.pkg.dev/axiom-conscience/axiom-repo/axiom-backend:latest"
}

variable "backend_memory" {
  description = "Cloud Run memory allocation"
  type        = string
  default     = "2Gi"
}

variable "backend_cpu" {
  description = "Cloud Run CPU allocation"
  type        = string
  default     = "2"
}

variable "max_instances" {
  description = "Maximum Cloud Run instances"
  type        = number
  default     = 100
}

# Enable Required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "storage-api.googleapis.com",
    "aiplatform.googleapis.com",
    "cloudbuild.googleapis.com",
    "logging.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com"
  ])

  service            = each.value
  disable_on_destroy = false
}

# Service Account
resource "google_service_account" "backend" {
  account_id   = "axiom-backend"
  display_name = "AXIOM Backend Service Account"
}

# IAM Roles
resource "google_project_iam_member" "backend_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/datastore.user",
    "roles/firebase.viewer",
    "roles/storage.objectAdmin",
    "roles/aiplatform.user",
    "roles/logging.logWriter"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# Cloud Storage Bucket
resource "google_storage_bucket" "axiom_storage" {
  name          = "${var.project_id}-storage"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }
}

# Storage folders
resource "google_storage_bucket_object" "reports_folder" {
  bucket = google_storage_bucket.axiom_storage.name
  name   = "reports/"
  source = "/dev/null"
}

# Firestore Database
resource "google_firestore_database" "axiom_firestore" {
  name            = "(default)"
  location_id     = var.region
  type            = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"

  depends_on = [google_project_service.apis["firestore.googleapis.com"]]
}

# Cloud Run Service
resource "google_cloud_run_service" "backend" {
  name     = "axiom-backend"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.backend.email
      timeout_seconds      = 900
      memory_limit         = var.backend_memory

      containers {
        image = var.backend_image

        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }

        env {
          name  = "GOOGLE_CLOUD_LOCATION"
          value = var.region
        }

        env {
          name  = "GEMINI_MODEL"
          value = "gemini-3.1-pro-preview"
        }

        env {
          name  = "GEMINI_THINKING_LEVEL"
          value = "HIGH"
        }

        env {
          name  = "GOOGLE_GENAI_USE_VERTEXAI"
          value = "True"
        }

        env {
          name  = "FIREBASE_DATABASE_URL"
          value = "https://${var.project_id}-default-rtdb.firebaseio.com"
        }

        env {
          name  = "FIREBASE_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "FIREBASE_STORAGE_BUCKET"
          value = "${var.project_id}.appspot.com"
        }

        env {
          name  = "API_PORT"
          value = "8080"
        }

        env {
          name  = "API_HOST"
          value = "0.0.0.0"
        }

        env {
          name  = "CORS_ORIGINS"
          value = "https://${var.project_id}.firebaseapp.com,https://axiom.run.app"
        }

        ports {
          container_port = 8080
        }
      }

      container_concurrency = 80
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = var.max_instances
        "autoscaling.knative.dev/minScale" = "1"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_project_iam_member.backend_roles
  ]
}

# Cloud Run Service - Allow unauthenticated access
resource "google_cloud_run_service_iam_member" "noauth" {
  service       = google_cloud_run_service.backend.name
  location      = google_cloud_run_service.backend.location
  role          = "roles/run.invoker"
  member        = "allUsers"
}

# Logging
resource "google_logging_project_sink" "axiom_sink" {
  name        = "axiom-sink"
  destination = "logging.googleapis.com/projects/${var.project_id}/logs/axiom"

  filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"axiom-backend\""
}

# Outputs
output "backend_url" {
  value       = google_cloud_run_service.backend.status[0].url
  description = "Backend Cloud Run URL"
}

output "storage_bucket" {
  value       = google_storage_bucket.axiom_storage.name
  description = "Cloud Storage bucket name"
}

output "firestore_database" {
  value       = google_firestore_database.axiom_firestore.name
  description = "Firestore database name"
}

output "service_account_email" {
  value       = google_service_account.backend.email
  description = "Backend service account email"
}
