import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root',
})
export class AjaxService {
  _URL = ""  
 
 sendRequest(method:any, url:any, parameters:any={}) {
	let options:any={
		"baseURL":this._URL,
		"url":  url,   
		"method": method.toUpperCase(),
		"headers": {"Accept": "application/json"},
		"responseType": "json",
		"timeout": 5000,
	}
	if(parameters instanceof FormData){
		// i parametri rimangono così come sono e vengono inseriti nel body
		options.headers["Content-Type"]='multipart/form-data;' 
		options["data"]=parameters     // Accept FormData, File, Blob
	}	
	else if(method.toUpperCase()=="GET"){
	    options.headers["Content-Type"] =
		                    'application/x-www-form-urlencoded;charset=utf-8'
	    options["params"]=parameters   // Accept plain object or URLSearchParams
	}
	else{
		// JSON-Server
		options.headers["Content-Type"] = 'application/json; charset=utf-8'  
	}	
	let promise = axios(options)      
	return promise	
 }

 errore(err:any) {
	if(!err.response) 
		alert("Connection Refused or Server timeout");	
	else if (err.response.status == 200)
        alert("Formato dei dati non corretto : " + err.response.data);
    else{
        alert("Server Error: " +err.response.status + " - " +err.response.data)
	}
 }
 
}


