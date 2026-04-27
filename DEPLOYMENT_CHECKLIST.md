# ✅ AXIOM GCP Deployment Checklist

Use this checklist to track your deployment progress.

---

## 🔐 Phase 1: GCP Account & Authentication

- [ ] **GCP Account Setup**
  - [ ] Google Cloud account created
  - [ ] Project "axiom-conscience" created
  - [ ] Billing enabled
  - [ ] Link: https://console.cloud.google.com/

- [ ] **Local Setup**
  - [ ] `gcloud` CLI installed
  - [ ] `gcloud auth login` completed
  - [ ] `gcloud config set project axiom-conscience` done
  - [ ] `docker` installed and running

- [ ] **Service Account**
  - [ ] Service account "axiom-backend" created
  - [ ] IAM roles granted (run.admin, datastore.user, etc.)
  - [ ] Service account key downloaded to `~/axiom-sa-key.json`
  - [ ] `export GOOGLE_APPLICATION_CREDENTIALS=~/axiom-sa-key.json` set

---

## 🚀 Phase 2: Backend Deployment

- [ ] **GCP Services**
  - [ ] Cloud Run API enabled
  - [ ] Firestore API enabled
  - [ ] Firebase API enabled
  - [ ] Cloud Storage API enabled
  - [ ] Artifact Registry API enabled
  - [ ] Cloud Build API enabled
  - [ ] AI Platform API enabled

- [ ] **Docker Image**
  - [ ] `Dockerfile` in project root ready
  - [ ] Docker image builds: `docker build -t axiom-backend:latest -f Dockerfile .`
  - [ ] Image tested locally: `docker run -p 8080:8080 axiom-backend:latest`
  - [ ] Health endpoint verified

- [ ] **Artifact Registry**
  - [ ] Repository "axiom-repo" created
  - [ ] Docker auth configured: `gcloud auth configure-docker us-central1-docker.pkg.dev`
  - [ ] Image tagged and pushed to registry
  - [ ] Image URL: `us-central1-docker.pkg.dev/axiom-conscience/axiom-repo/axiom-backend:latest`

- [ ] **Cloud Run Deployment**
  - [ ] Backend deployed to Cloud Run
  - [ ] Service name: "axiom-backend"
  - [ ] Region: "us-central1"
  - [ ] Memory: 2Gi
  - [ ] CPU: 2
  - [ ] Max instances: 100
  - [ ] Allow unauthenticated access enabled

- [ ] **Backend Verification**
  - [ ] Cloud Run service created
  - [ ] Health check passes: `curl $BACKEND_URL/health`
  - [ ] Response: `{"status":"ok","version":"0.1.0"}`
  - [ ] Backend URL saved: `$BACKEND_URL`

---

## 🎨 Phase 3: Cloud Storage & Databases

- [ ] **Cloud Storage**
  - [ ] Bucket "axiom-conscience-storage" created
  - [ ] Reports folder created: `gs://axiom-conscience-storage/reports/`
  - [ ] Service account has objectAdmin role

- [ ] **Firestore Database**
  - [ ] Database initialized in us-central1
  - [ ] Collections created (projects, decisions, reports)
  - [ ] Security rules deployed
  - [ ] Indexed fields optimized

- [ ] **Firebase Realtime Database**
  - [ ] Database initialized
  - [ ] Real-time rules configured
  - [ ] Backup enabled

- [ ] **Firebase Storage**
  - [ ] Storage bucket initialized
  - [ ] Security rules configured
  - [ ] CORS configured for frontend

---

## 💻 Phase 4: Frontend Deployment

- [ ] **Frontend Build**
  - [ ] Dependencies installed: `cd frontend && npm install`
  - [ ] `.env.production` created with `REACT_APP_API_URL=$BACKEND_URL`
  - [ ] Frontend builds: `npm run build`
  - [ ] Build artifacts in `frontend/build/`

- [ ] **Firebase Hosting Setup**
  - [ ] Firebase CLI installed: `npm install -g firebase-tools`
  - [ ] Firebase login: `firebase login`
  - [ ] Hosting initialized: `firebase init hosting`
  - [ ] Firebaserc configured for project

- [ ] **Frontend Deployment**
  - [ ] Frontend deployed: `firebase deploy`
  - [ ] Hosting URL working: `https://axiom-conscience.firebaseapp.com`
  - [ ] CORS updated on backend for new URL
  - [ ] Frontend loads without errors

---

## 🔧 Phase 5: Configuration & Security

- [ ] **Environment Variables**
  - [ ] Backend .env.production configured
  - [ ] GEMINI_MODEL set to gemini-3.1-pro-preview
  - [ ] GOOGLE_API_KEY set (if using GenAI)
  - [ ] FIREBASE credentials set
  - [ ] CORS_ORIGINS includes frontend URL

- [ ] **Security**
  - [ ] Service account key secured
  - [ ] IAM roles follow least privilege
  - [ ] Firestore security rules deployed
  - [ ] Firebase realtime rules configured
  - [ ] Storage rules configured
  - [ ] CORS properly configured

- [ ] **API Keys**
  - [ ] Gemini API key added
  - [ ] Firebase web config added to frontend
  - [ ] No secrets in GitHub

---

## 📊 Phase 6: Monitoring & Logging

- [ ] **Logging**
  - [ ] Cloud Logging enabled
  - [ ] Log sink created for axiom-backend
  - [ ] Logs viewable: `gcloud run logs read axiom-backend --limit 50`

- [ ] **Monitoring**
  - [ ] Cloud Monitoring dashboard created
  - [ ] Alerts configured for errors
  - [ ] Email notifications set up
  - [ ] Uptime checks enabled

- [ ] **Backup & Disaster Recovery**
  - [ ] Firestore backup scheduled
  - [ ] Storage versioning enabled
  - [ ] Export strategy defined

---

## 🧪 Phase 7: Testing & Validation

- [ ] **API Tests**
  - [ ] Health check: `curl $BACKEND_URL/health`
  - [ ] Upload test: `curl -F file=@sample.csv $BACKEND_URL/api/v1/upload`
  - [ ] Intercept test: POST to `/api/v1/intercept`
  - [ ] Get metrics: `curl $BACKEND_URL/api/v1/metrics/test-project`

- [ ] **Frontend Tests**
  - [ ] Frontend loads at Firebase URL
  - [ ] Upload dataset works
  - [ ] Constitution form submits
  - [ ] Batch audit runs
  - [ ] Report generation works
  - [ ] No CORS errors in console

- [ ] **End-to-End Flow**
  - [ ] Upload sample CSV
  - [ ] Save fairness rules
  - [ ] Run batch audit
  - [ ] View report
  - [ ] Export results

---

## 🌐 Phase 8: Custom Domain (Optional)

- [ ] **Domain Setup**
  - [ ] Custom domain registered
  - [ ] DNS records configured
  - [ ] SSL certificate generated
  - [ ] Domain mapped to Cloud Run
  - [ ] Domain mapped to Firebase Hosting

- [ ] **Domain Verification**
  - [ ] Backend accessible at custom domain
  - [ ] Frontend accessible at custom domain
  - [ ] SSL working (HTTPS)
  - [ ] No mixed content warnings

---

## 📈 Phase 9: Production Hardening

- [ ] **Performance**
  - [ ] Cloud Run autoscaling configured
  - [ ] Caching enabled on Firebase Hosting
  - [ ] CDN enabled
  - [ ] Load testing completed

- [ ] **Reliability**
  - [ ] Health checks working
  - [ ] Graceful error handling
  - [ ] Database backups working
  - [ ] Failover plan documented

- [ ] **Documentation**
  - [ ] README updated with deployment info
  - [ ] API documentation deployed
  - [ ] Runbook created
  - [ ] Team trained on deployment

---

## 📋 Phase 10: Post-Deployment

- [ ] **Verification**
  - [ ] All services running
  - [ ] No critical errors in logs
  - [ ] Performance metrics normal
  - [ ] Database connected
  - [ ] Frontend communicating with backend

- [ ] **Documentation**
  - [ ] Deployment info saved: `deployment-info.txt`
  - [ ] URLs documented
  - [ ] Credentials secured
  - [ ] Rollback procedure documented

- [ ] **Team Handoff**
  - [ ] Team trained on system
  - [ ] Support plan established
  - [ ] Monitoring dashboard shared
  - [ ] Incident response plan ready

---

## 🎉 Deployment Complete!

When all checkboxes are ticked:

✅ Backend running on Cloud Run  
✅ Frontend deployed to Firebase Hosting  
✅ Database configured and secured  
✅ Monitoring and logging enabled  
✅ Custom domain (optional) working  
✅ Team trained and ready  

**Next Steps:**
- Monitor error rates and performance
- Set up on-call rotation
- Plan feature releases
- Regular security audits
- Cost optimization review

---

**Save this checklist** and update as you progress through each phase.
