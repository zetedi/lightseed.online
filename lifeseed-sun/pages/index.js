import React, { useState, useEffect, useRef } from 'react';
import { CloudinaryContext, Image } from 'cloudinary-react';
import Head from 'next/head';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Canvas, useFrame } from '@react-three/fiber';
import { fetchPhotos, openUploadWidget } from '../lib/cloudinaryService';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  landing: {
    display: 'grid',
  },
}));

function Sphere(props) {
  // This reference will give us direct access to the mesh
  const mesh = useRef();
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);
  // Rotate mesh every frame, this is outside of React without overhead
  useFrame((state, delta) => (mesh.current.rotation.x += 0.01));
  // Return view, these are regular threejs elements expressed in JSX
  return (
    <mesh
      {...props}
      ref={mesh}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
    >
      <sphereGeometry args={[1, 37, 37]} />
      <meshStandardMaterial color={hovered ? 'violet' : 'orange'} />
    </mesh>
  );
}

function Torus(props) {
  const mesh = useRef();
  useFrame((state, delta) => (mesh.current.rotation.x += 0.01));
  return (
    <mesh {...props} ref={mesh} scale={1}>
      <torusGeometry args={[10, 3, 16, 100]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
}

export default function Index() {
  const classes = useStyles();

  const [images, setImages] = useState([]);

  const beginUpload = (tag) => {
    const uploadOptions = {
      cloudName: 'ezimg',
      tags: [tag, 'lifeseed'],
      uploadPreset: 'wobiwbrp',
      sources: ['local', 'camera'],
    };
    openUploadWidget(uploadOptions, (error, photos) => {
      if (!error) {
        console.log(photos);
        if (photos.event === 'success') {
          setImages([...images, photos.info.secure_url]);
          console.log(photos.info);
        }
      } else {
        console.log(error);
      }
    });
  };

  useEffect(() => {
    fetchPhotos('image', setImages);
  }, []);

  return (
    <>
      <script
        src="https://widget.cloudinary.com/v2.0/global/all.js"
        type="text/javascript"
      />
      <Head>
        <title>lifeseed online</title>
      </Head>
      <Box className={classes.landing}>
        <Canvas style={{ height: '70vh' }}>
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          <Sphere position={[0, 0, 0]} />
          <Torus position={[0, 0, 0]} />
        </Canvas>
      </Box>
      <CloudinaryContext cloudName="ezimg">
        <div className="App">
          <button onClick={() => beginUpload('image')}>Upload Image</button>
          <section>
            {images.map((i) => (
              <Image key={i} publicId={i} fetch-format="auto" quality="auto" />
            ))}
          </section>
        </div>
      </CloudinaryContext>
    </>
  );
}
