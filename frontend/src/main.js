import 'virtual:windi.css'
import * as Vue  from 'vue'
import router from './router'
import App from './App.vue'
import { initializeApp } from 'firebase/app'
import { getFirestore } from "firebase/firestore"
import { Buffer } from 'buffer'

if (window) {
	window.Buffer = Buffer
}

const app = Vue.createApp(App)

const firebaseConfig = {
	apiKey: "AIzaSyCL0TqPIAx-HOb12mWeS7iP_uB-RMYfm1w",
	authDomain: "near-api-1d073.firebaseapp.com",
	projectId: "near-api-1d073",
	storageBucket: "near-api-1d073.appspot.com",
	messagingSenderId: "77148669093",
	appId: "1:77148669093:web:0723fee1a7ba423907394c",
	measurementId: "G-DGTKFVLVL2"
};
const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore();
app.config.globalProperties.$firebase = firebaseApp
app.config.globalProperties.$db = db

app.use(router)

app.mount('#app')
