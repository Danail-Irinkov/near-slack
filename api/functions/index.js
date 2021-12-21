// Import the functions you need from the SDKs you need
// import * as functions from "firebase-functions";
// import { getAnalytics } from "firebase/analytics";
// import { app, firestore  } from "firebase-admin";
// const { getFirestore, Timestamp, FieldValue } = firestore;
// const { initializeApp,applicationDefault, cert } = app;

const { getAnalytics } = require('firebase/analytics');
const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

// The Firebase Admin SDK to access Firestore.
admin.initializeApp();

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCL0TqPIAx-HOb12mWeS7iP_uB-RMYfm1w",
  authDomain: "near-api-1d073.firebaseapp.com",
  projectId: "near-api-1d073",
  storageBucket: "near-api-1d073.appspot.com",
  messagingSenderId: "77148669093",
  appId: "1:77148669093:web:0723fee1a7ba423907394c",
  measurementId: "G-DGTKFVLVL2"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
// const analytics = getAnalytics(firebaseApp);
const db = getFirestore();

// const express = require("express");

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

const docRef = db.collection('users').doc('alovelace');

async function f() {
    let result = await docRef.set({
      first: 'Ada',
      last: 'Lovelace',
      born: 1815
    });

    const snapshot = await db.collection('users').get();
    snapshot.forEach((doc) => {
        console.log("User: ", doc.id, '=>', doc.data());
    });

    console.log("Result: ", result);
}
f().then(() => {});

exports.helloWorld = functions.https.onRequest((request, response) => {
    
    f();
    
    functions.logger.info("Hello logs!", {structuredData: true});
    response.send("Hello from Firebase!");
});



