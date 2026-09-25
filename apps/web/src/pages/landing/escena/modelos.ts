import * as THREE from "three";
import type { Token } from "../paleta";

/** Caja trasladada (el origen de la geometría queda en el centro de la caja). */
export function caja(ancho: number, alto: number, fondo: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(ancho, alto, fondo);
  g.translate(x, y, z);
  return g;
}

/** Piezas estáticas agrupadas por color: cada grupo se combina en una sola malla. */
export type Piezas = Map<Token, THREE.BufferGeometry[]>;

export function agregar(piezas: Piezas, token: Token, ...geometrias: THREE.BufferGeometry[]) {
  const lista = piezas.get(token) ?? [];
  lista.push(...geometrias);
  piezas.set(token, lista);
}

/** Estante de tres niveles: parantes, bandejas y travesaños (en coordenadas de mundo). */
export function estante(piezas: Piezas, cx: number, cz: number, ancho: number, fondo: number, alto: number, niveles: number[]) {
  const p = 0.09;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      agregar(piezas, "marino", caja(p, alto, p, cx + sx * (ancho / 2 - p / 2), alto / 2, cz + sz * (fondo / 2 - p / 2)));
    }
    // Arriostre lateral en X, típico de un rack de carga.
    const brazo = caja(p * 0.6, Math.hypot(fondo, alto * 0.45), p * 0.6, 0, 0, 0);
    brazo.rotateX(Math.atan2(fondo, alto * 0.45));
    brazo.translate(cx + sx * (ancho / 2 - p / 2), alto * 0.5, cz);
    agregar(piezas, "marino-600", brazo);
  }
  for (const y of niveles) {
    agregar(piezas, "marino-600", caja(ancho, 0.07, fondo, cx, y, cz));
    agregar(piezas, "marino", caja(ancho, 0.12, 0.06, cx, y - 0.02, cz + fondo / 2));
  }
  agregar(piezas, "marino", caja(ancho, 0.1, 0.07, cx, alto - 0.05, cz + fondo / 2), caja(ancho, 0.1, 0.07, cx, alto - 0.05, cz - fondo / 2));
}

/** Parihuela (pallet) de madera estilizada. */
export function parihuela(material: (t: Token) => THREE.Material) {
  const g = new THREE.Group();
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.0), material("marino-500"));
  tabla.position.y = 0.15;
  g.add(tabla);
  for (const z of [-0.42, 0, 0.42]) {
    const taco = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.14), material("marino-600"));
    taco.position.set(0, 0.06, z);
    g.add(taco);
  }
  return g;
}

/** Carga de un pedido: cajas apiladas sobre la parihuela. */
export function carga(material: (t: Token) => THREE.Material, token: Token, etiqueta: Token) {
  const g = parihuela(material);
  const cajas: [number, number, number, number, number, number][] = [
    [0.5, 0.42, 0.46, -0.26, 0.4, -0.24],
    [0.5, 0.42, 0.46, 0.26, 0.4, -0.24],
    [0.5, 0.42, 0.46, -0.26, 0.4, 0.24],
    [0.5, 0.42, 0.46, 0.26, 0.4, 0.24],
    [0.5, 0.38, 0.46, 0.0, 0.8, 0.0],
  ];
  for (const [w, h, d, x, y, z] of cajas) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(token));
    m.position.set(x, y, z);
    g.add(m);
  }
  const rotulo = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.3), material(etiqueta));
  rotulo.position.set(0.52, 0.42, 0.24);
  g.add(rotulo);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/** Montacargas low-poly mirando hacia +X (las uñas quedan al frente). */
export function montacargas(material: (t: Token) => THREE.Material) {
  const g = new THREE.Group();
  const piezas: [Token, number, number, number, number, number, number][] = [
    ["teal-700", 1.3, 0.5, 0.9, -0.15, 0.45, 0], // chasis
    ["teal-800", 0.5, 0.45, 0.86, -0.62, 0.55, 0], // contrapeso
    ["marino-900", 0.36, 0.3, 0.5, -0.2, 0.85, 0], // asiento
    ["marino-900", 0.06, 1.1, 0.06, -0.5, 1.25, 0.38], // parantes de la cabina
    ["marino-900", 0.06, 1.1, 0.06, -0.5, 1.25, -0.38],
    ["marino-900", 0.06, 1.1, 0.06, 0.3, 1.25, 0.38],
    ["marino-900", 0.06, 1.1, 0.06, 0.3, 1.25, -0.38],
    ["teal-800", 0.9, 0.06, 0.86, -0.1, 1.82, 0], // techo
    ["marino", 0.1, 1.9, 0.1, 0.58, 0.95, 0.3], // mástil
    ["marino", 0.1, 1.9, 0.1, 0.58, 0.95, -0.3],
    ["marino-900", 0.9, 0.05, 0.12, 1.08, 0.12, 0.24], // uñas
    ["marino-900", 0.9, 0.05, 0.12, 1.08, 0.12, -0.24],
  ];
  for (const [t, w, h, d, x, y, z] of piezas) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(t));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  }
  const rueda = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 10);
  rueda.rotateX(Math.PI / 2);
  for (const [x, z] of [
    [0.25, 0.46],
    [0.25, -0.46],
    [-0.6, 0.46],
    [-0.6, -0.46],
  ]) {
    const m = new THREE.Mesh(rueda, material("marino-900"));
    m.position.set(x, 0.2, z);
    g.add(m);
  }
  return g;
}

/** Camión con la puerta de carga hacia −X. `franja` distingue despacho (verde azulado) de proveedor. */
export function camion(material: (t: Token) => THREE.Material, franja: Token) {
  const g = new THREE.Group();
  const piezas: [Token, number, number, number, number, number, number][] = [
    ["blanco", 3.6, 1.9, 1.9, 0, 1.45, 0], // furgón
    [franja, 3.62, 0.22, 1.92, 0, 0.9, 0], // franja inferior
    ["marino-900", 0.04, 1.6, 1.5, -1.81, 1.45, 0], // puerta trasera abierta (oscura)
    ["marino", 1.2, 1.3, 1.8, 2.4, 1.1, 0], // cabina
    ["teal-100", 0.04, 0.5, 1.5, 3.01, 1.45, 0], // parabrisas
    ["marino-900", 5.0, 0.2, 1.6, 0.6, 0.4, 0], // bastidor
  ];
  for (const [t, w, h, d, x, y, z] of piezas) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(t));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  const rueda = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  rueda.rotateX(Math.PI / 2);
  for (const x of [-1.1, 0.2, 2.4]) {
    for (const z of [0.85, -0.85]) {
      const m = new THREE.Mesh(rueda, material("marino-900"));
      m.position.set(x, 0.38, z);
      g.add(m);
    }
  }
  return g;
}
