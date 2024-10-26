Collaborative Editor


<h1>Backend</h1>
- ExpressJS API 
- Socket.io WS server 
- GCP Cloud Data store 

Commands to setup App
```
gcloud auth login jaylohokare@gmail.com
gcloud config set project sullyhackathon
gcloud projects add-iam-policy-binding sullyhackathon --member=user:jaylohokare@gmail.com --role=roles/appengine.deployer
```

Deploy
```
gcloud app deploy
```

URL 
```
https://sullyhackathon.uw.r.appspot.com
```


<h1>Frontend</h1>
- ReactJS webapp 


<h1>Architecture</h1>

1. CRUD on FireStore to store Users / Documents / Document Deltas
2. Document lifecycle - 
-- I am storing "deltas" on cloud store to 