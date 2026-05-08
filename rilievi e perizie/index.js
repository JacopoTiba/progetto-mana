"use strict";

// const style = myFullStyle
const style = myMapLibre.openMapsStyle
const mapContainer = document.getElementById("mapContainer")
const address1 = "68 Via San Michele, Fossano, Italia"
const address2 = "15 Via Onorato Vigliani, Torino, Italia"
const zoom = 15.5  // 1-25
const icon = "./img/university.png"    

infoPercorso.style.display="none"


// btn va preso qui perchè, se lo leggiamo DOPO che la mappa è stata creata,
// nel frattempo la mappa ha già creato altri pulsanti (quelli di zoom)
// ed il query selector prende quelli !!!! Oppure assegnamo un ID
const btn = document.querySelector("button")


loadMap()


async function loadMap(){
		
    const gpsAddress = await myMapLibre.geocode(address1)	
	await myMapLibre.drawMap(style, mapContainer, gpsAddress, zoom )
	
	if(myMapLibre.map){
		myMapLibre.addPOILayer()

		let marker1 =  myMapLibre.addMarker(gpsAddress, icon, "IIS Vallauri Fossano")
		marker1.getElement().addEventListener('click', () => {
			console.log("marker1 clicked", gpsAddress);
		});			 
		const result = await myMapLibre.drawSingleRoute(address1, address2, "#00F")
		infoPercorso.style.display=""
		infoPercorso.children[0].textContent += result.distance
		infoPercorso.children[1].textContent += result.duration/60

		const gpsAddress2 = await myMapLibre.geocode(address2)			
		let marker2 = await myMapLibre.addMarker(gpsAddress2, "", "Questa è la tua destinazione")
		marker2.getElement().addEventListener('click', () => {
			location.reload()
		});	 
	}
	
	btn.addEventListener("click", async function(){
		const gpsAddress = await myMapLibre.geocode(address2)	
		await myMapLibre.drawMap(style, mapContainer, gpsAddress, zoom )
	}) 
}


// AUMENTARE IL TIMEOUT DI SENDREQUEST A 10 SEC !!

 
