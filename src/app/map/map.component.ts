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

  latitude5: number = 47.501433;
  longitude5: number = 19.037258;

  latitude6: number = 47.488396;
  longitude6: number = 19.065012;

  // Define our base layers so we can reference them multiple times
  streetMaps = tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  wMaps = tileLayer('http://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png', {
    detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  lifetree0 = this.lifeseed0(0, 'Mahameru', this.latitude0, this.longitude0)
  lifetree1 = this.lifeseed(1, 'Phoenix', this.latitude1, this.longitude1);
  lifetree2 = this.lifeseed(2, 'Le petit prince', this.latitude2, this.longitude2);
  lifetree3 = this.lifeseed(3, 'Little Bird', this.latitude3, this.longitude3);
  lifetree4 = this.lifeseed0(0, 'Madeira', this.latitude4, this.longitude4);
  lifetree5 = this.lifeseed0(0, 'Hobbit', this.latitude5, this.longitude5);
  lifetree6 = this.lifeseed0(0, 'Maya', this.latitude6, this.longitude6);

  // Layers control object with our two base layers and the tree overlay layers
  leafletLayersControl = {
    baseLayers: {
      'Street Maps': this.streetMaps,
      'Wikimedia Maps': this.wMaps
    },
    overlays: {      
      'Mahameru': this.lifetree0,
      'Phoenix': this.lifetree1,
      'Le petite prince': this.lifetree2,      
      'Little Bird': this.lifetree3,
      'Madeira': this.lifetree4,
      'Hobbit': this.lifetree5,
      'Maya': this.lifetree6
    }
  };

  leafletOptions = {
    layers: [this.streetMaps, this.lifetree0, this.lifetree1, this.lifetree2, this.lifetree3, this.lifetree4, this.lifetree5, this.lifetree6],
    zoom: 4.5,
    center: latLng([this.center_lat, this.center_lon])
  };

  constructor() { }

  ngOnInit() {

  }

  lifeseed(id, name, latitude, longitude) {    
    return marker([latitude, longitude], {
      icon: icon({
        iconSize: [77, 77],
        iconAnchor: [12, 42],
        popupAnchor: [42, -42],
        iconUrl: '/assets/img/lifetree' + id + '.png',
        shadowUrl: 'leaflet/marker-shadow.png'
      })
    }).bindPopup('<div style="text-align: center;"><b>' + name + '</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree' + id + '.png"/></div>');
  }

  lifeseed0(id, name, latitude, longitude) {    
    return marker([latitude, longitude], {
      icon: icon({
        iconSize: [49, 49],
        iconAnchor: [12, 42],
        popupAnchor: [42, -42],
        iconUrl: '/assets/img/lifetree' + id + '.png',
        shadowUrl: 'leaflet/marker-shadow.png'
      })
    }).bindPopup('<div style="text-align: center;"><b>' + name + '</b></div><br/><div style="text-align: center;"><img width="297px" src="/assets/img/lifetree' + id + '.png"/></div>');
  }

}

