import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Canvas, useFrame } from '@react-three/fiber';
import { useLifeseed } from '../components/admin/useLifeseed';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  main: {
    display: 'grid',
    position: 'relative',
  },
}));

function Sphere(props) {
  const { active, setActive } = props;
  // This reference will give us direct access to the mesh
  const mesh = useRef();
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false);
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
      <meshStandardMaterial color={hovered ? 'yellow' : 'orange'} />
    </mesh>
  );
}

function Torus(props) {
  const mesh = useRef();
  useFrame((state, delta) => (mesh.current.rotation.x += 0.001));
  return (
    <mesh {...props} ref={mesh} scale={1}>
      <torusGeometry args={[10, 3, 16, 100]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

export default function Index() {
  const classes = useStyles();
  const lifeseed = useLifeseed();
  const [active, setActive] = useState(false);
  return (
    <>
      <Head>
        <title>lifeseed online</title>
      </Head>
      <Box className={classes.main}>
        <Canvas style={{ height: '70vh' }}>
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          <Sphere position={[0, 0, 0]} active={active} setActive={setActive} />
          <Torus position={[0, 0, 0]} />
        </Canvas>
        {active ? (
          <Link
            href={
              lifeseed?.lifetree?.id
                ? `/lifetree/${lifeseed?.lifetree?.id}`
                : '/saveLifetree'
            }
          >
            <Box
              style={{
                fontFamily: 'Lobster, cursive',
                color: '#fafafa',
                position: 'absolute',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'center',
                // top: '7%',
                fontSize: '5rem',
                // textShadow: '2px 2px 5px #076ff0',
                textShadow: '2px 2px 7px #004943',
              }}
            >
              grow
            </Box>
          </Link>
        ) : (
          ''
        )}
      </Box>
    </>
  );
}
