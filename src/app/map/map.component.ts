import { Component, OnInit } from '@angular/core';
import { icon, latLng, marker, polyline, tileLayer } from 'leaflet';

// declare var ol: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})

export class MapComponent implements OnInit {

  clat: number = 44.49;
  clon: number = 4.49;

  latitude1: number = 50.8355;
  longitude1: number = 4.4035;

  latitude3: number = 50.917434;
  longitude3: number = 5.252158;

  // Define our base layers so we can reference them multiple times
  streetMaps = tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  wMaps = tileLayer('http://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png', {
    detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // Marker for the top of Mt. Ranier
  lifetree1 = marker([ this.latitude1, this.longitude1 ], {
    icon: icon({
      iconSize: [ 49, 49 ],
      iconAnchor: [ 13, 41 ],
      popupAnchor: [ 10, -42],
      iconUrl: '/assets/img/lifetree1_s.jpg',
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('This is <b>Mahameru</b>');

  lifetree3 = marker([ this.latitude3, this.longitude3 ], {
    icon: icon({
      iconSize: [ 49, 49 ],
      iconAnchor: [ 13, 41 ],
      popupAnchor: [ 10, -42],
      iconUrl: '/assets/img/lifetree3_s.jpg',
      shadowUrl: 'leaflet/marker-shadow.png'
    })
  }).bindPopup('This is <b>Little Bird</b>');


   // Layers control object with our two base layers and the three overlay layers
   layersControl = {
    baseLayers: {
      'Street Maps': this.streetMaps,
      'Wikimedia Maps': this.wMaps
    },
    overlays: {
      'Mahameru': this.lifetree1,
      'Little Bird': this.lifetree3
    }
  };

  options = {
    layers: [ this.streetMaps, this.lifetree1, this.lifetree3],
    zoom: 4.5,
    center: latLng([ this.clat, this.clon ])
  };

  constructor() { }

  ngOnInit() {

  }

}

