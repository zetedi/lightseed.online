import { Component, OnInit } from '@angular/core';
import { icon, latLng, marker, polyline, tileLayer } from 'leaflet';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})

export class MapComponent implements OnInit {

  center_lat: number = 44.49;
  center_lon: number = 4.49;

  latitude0: number = 50.8355;
  longitude0: number = 4.4035;

  latitude1: number = 46.0036;
  longitude1: number = 4.5006;

  latitude2: number = 47.9145;
  longitude2: number = 19.8489;

  latitude3: number = 50.917434;
  longitude3: number = 5.252158;

  latitude4: number = 32.800373;
  longitude4: number = -17.041834;

  // Define our base layers so we can reference them multiple times
  streetMaps = tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  wMaps = tileLayer('http://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png', {
    detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  lifetree0 = marker([ this.latitude0, this.longitude0 ], {
    icon: icon({
      iconSize: [ 77, 77 ],
      iconAnchor: [ 12, 42 ],
      popupAnchor: [ 42, -42],
      iconUrl: '/assets/img/lifetree0.png', //a tree in a 1749px circle with 49px width white stroke on a 2048px^2 page
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('<div style="text-align: center;"><b>Mahameru</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree0.png"/></div>');

  lifetree1 = marker([ this.latitude1, this.longitude1 ], {
    icon: icon({
      iconSize: [ 77, 77 ],
      iconAnchor: [ 12, 42 ],
      popupAnchor: [ 42, -42],
      iconUrl: '/assets/img/lifetree1.png', //a tree in a 1749px circle with 49px width white stroke on a 2048px^2 page
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('<div style="text-align: center;"><b>Phoenix</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree1.png"/></div>');

  lifetree2 = marker([ this.latitude2, this.longitude2 ], {
    icon: icon({
      iconSize: [ 77, 77 ],
      iconAnchor: [ 12, 42 ],
      popupAnchor: [ 42, -42],
      iconUrl: '/assets/img/lifetree2.png', //a tree in a 1749px circle with 49px width white stroke on a 2048px^2 page
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('<div style="text-align: center;"><b>Le petit prince</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree2.png"/></div>');

  lifetree3 = marker([ this.latitude3, this.longitude3 ], {
    icon: icon({
      iconSize: [ 77, 77 ],
      iconAnchor: [ 12, 42 ],
      popupAnchor: [ 42, -42],
      iconUrl: '/assets/img/lifetree_inge.png',
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('<div style="text-align: center;"><b>Little Bird</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree_inge.png"/></div>');

  lifetree4 = marker([ this.latitude4, this.longitude4 ], {
    icon: icon({
      iconSize: [ 77, 77 ],
      iconAnchor: [ 12, 42 ],
      popupAnchor: [ 42, -42],
      iconUrl: '/assets/img/lifetree0.png',
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('<div style="text-align: center;"><b>Madeira</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree0.png"/></div>');

   // Layers control object with our two base layers and the three overlay layers
   layersControl = {
    baseLayers: {
      'Street Maps': this.streetMaps,
      'Wikimedia Maps': this.wMaps
    },
    overlays: {
      'Mahameru': this.lifetree0,
      'Phoenix': this.lifetree1,
      'Le petite prince': this.lifetree2,
      'Little Bird': this.lifetree3,
      'Madeira': this.lifetree4
    }
  };

  options = {
    layers: [ this.streetMaps, this.lifetree0, this.lifetree1, this.lifetree2, this.lifetree3, this.lifetree4],
    zoom: 4.5,
    center: latLng([ this.center_lat, this.center_lon ])
  };

  constructor() { }

  ngOnInit() {

  }

}

