import { Component, OnInit } from '@angular/core';

declare var ol: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})


export class MapComponent implements OnInit {

  constructor() { }

  clat: number = 49.49;
  clon: number = 11.49;

  latitude1: number = 50.8355;
  longitude1: number = 4.4035;

  latitude3: number = 50.917434;
  longitude3: number = 5.252158;

  map: any;

  ngOnInit() {
    this.map = new ol.Map({
      target: 'map',
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM()
        })
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([this.clon, this.clat]),
        zoom: 7
      })
    });
    this.addPoint(this.latitude1, this.longitude1, "/assets/img/lifetree1_s.jpg");
    this.addPoint(this.latitude3, this.longitude3, "/assets/img/lifetree3_s.jpg");

    // var element = document.getElementById('popup');

    // var popup = new ol.Overlay({
    //   element: element,
    //   positioning: 'bottom-center',
    //   stopEvent: false,
    //   offset: [0, -50]
    // });
    // this.map.addOverlay(popup);

    // // display popup on click
    // this.map.on('click', function (evt) {
    //   var feature = this.map.forEachFeatureAtPixel(evt.pixel,
    //     function (feature) {
    //       return feature;
    //     });
    //   if (feature) {
    //     var coordinates = feature.getGeometry().getCoordinates();
    //     popup.setPosition(coordinates);
    //     console.log("Coordinates: " + coordinates);
    //   }
    // });
  }

  addPoint(lat: number, lng: number, img: string) {
    var vectorLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
        features: [new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.transform([lng, lat], 'EPSG:4326', 'EPSG:3857')),
        })]
      }),
      style: new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
          src: img
        })
      })
    });
    this.map.addLayer(vectorLayer);
  }
}

