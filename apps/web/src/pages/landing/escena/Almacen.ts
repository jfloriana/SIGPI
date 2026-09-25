import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  CATEGORIAS,
  ESTANTE,
  PISO,
  RUTA_DESPACHO,
  TAMANO_CAJA,
  ZONAS,
  ubicarProductos,
  type Categoria,
} from "../datos";
import type { Paleta, Token } from "../paleta";
import { agregar, camion, caja, carga, estante, montacargas, parihuela, type Piezas } from "./modelos";

/** Encuadre de cámara para cada estación del recorrido. */
interface Cuadro {
  objetivo: [number, number, number];
  /** Ancho y alto de mundo que deben caber en pantalla. */
  ancho: number;
  alto: number;
  /** Desplazamiento del objetivo en pantalla (fracción del ancho/alto; +x derecha, +y arriba). */
  dx: number;
  dy: number;
}

const CUADROS_ANCHO: Cuadro[] = [
  { objetivo: [3, 0.4, -0.5], ancho: 50, alto: 26, dx: 0.22, dy: -0.02 },
  { objetivo: [-7, 0.8, 4.6], ancho: 25, alto: 14, dx: 0.17, dy: 0 },
  { objetivo: [12.2, 0.8, 3], ancho: 26, alto: 15, dx: 0.17, dy: 0 },
  { objetivo: [7.5, 1, -4.6], ancho: 28, alto: 16, dx: 0.17, dy: 0 },
];

const CUADROS_COMPACTOS: Cuadro[] = [
  { objetivo: [3, 0.4, -0.5], ancho: 36, alto: 16, dx: 0, dy: -0.25 },
  { objetivo: [-7, 0.8, 4.6], ancho: 17, alto: 9, dx: 0, dy: 0.28 },
  { objetivo: [12.2, 0.8, 3], ancho: 18, alto: 9, dx: 0, dy: 0.28 },
  { objetivo: [7.5, 1, -4.6], ancho: 20, alto: 10, dx: 0, dy: 0.28 },
];

/** Dirección isométrica de la cámara, levemente más baja que la isometría pura. */
const DIRECCION = new THREE.Vector3(1, 0.86, 1.18).normalize();

export interface Etiqueta {
  el: HTMLElement;
  ancla: string;
  /** Estaciones (0 = portada, 1–3) en las que la etiqueta se muestra. */
  estaciones: number[];
  /** Desplazamiento en píxeles desde el ancla (ancho ≥ 768 px y celular). */
  desfase?: [number, number];
  desfaseMovil?: [number, number];
}

interface Opciones {
  contenedor: HTMLElement;
  paleta: Paleta;
  movimientoReducido: boolean;
  /** Globo que muestra la categoría del estante bajo el puntero. */
  globo: HTMLElement | null;
}

const suave = (x: number) => x * x * (3 - 2 * x);

export class Almacen {
  private readonly contenedor: HTMLElement;
  private readonly paleta: Paleta;
  private readonly reducido: boolean;
  private readonly globo: HTMLElement | null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  private readonly camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly materiales = new Map<Token, THREE.MeshLambertMaterial>();
  private readonly materialAlerta: THREE.MeshLambertMaterial;
  /** Las otras seis alertas: ámbar, pero con menos brillo para que ACE lidere. */
  private readonly materialAlertaSecundaria: THREE.MeshLambertMaterial;
  private readonly marcaAlerta: THREE.Mesh;
  private readonly zonasEstante: THREE.Mesh[] = [];
  private readonly resaltado: THREE.Mesh;
  private readonly montacargas: THREE.Group;
  private readonly pedido: THREE.Group;
  private readonly ruta: THREE.CatmullRomCurve3;
  private readonly raycaster = new THREE.Raycaster();
  private readonly puntero = new THREE.Vector2();
  private readonly auxiliar = new THREE.Vector3();

  private etiquetas: Etiqueta[] = [];
  /** Ancho medido de cada etiqueta (se vuelve a medir al redimensionar). */
  private anchos = new Map<HTMLElement, number>();
  private ancho = 1;
  private alto = 1;
  private estacion = 0;
  private estacionObjetivo = 0;
  private intro: number;
  private reloj = 0;
  private ultimo = 0;
  private raf = 0;
  private enVista = true;
  private pestanaVisible = !document.hidden;
  private punteroPendiente = false;
  private punteroDentro = false;
  private estanteActivo: number | null = null;
  private readonly observadorTamano: ResizeObserver;
  private readonly observadorVista: IntersectionObserver;

  constructor({ contenedor, paleta, movimientoReducido, globo }: Opciones) {
    this.contenedor = contenedor;
    this.paleta = paleta;
    this.reducido = movimientoReducido;
    this.globo = globo;
    this.intro = movimientoReducido ? 1 : 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const lienzo = this.renderer.domElement;
    lienzo.setAttribute("aria-hidden", "true");
    lienzo.className = "landing-lienzo";
    contenedor.appendChild(lienzo);

    this.materialAlerta = new THREE.MeshLambertMaterial({
      color: paleta.ambar,
      emissive: new THREE.Color(paleta.ambar),
      emissiveIntensity: 0.35,
    });

    this.materialAlertaSecundaria = new THREE.MeshLambertMaterial({
      color: paleta.ambar,
      emissive: new THREE.Color(paleta.ambar),
      emissiveIntensity: 0.05,
    });

    this.iluminar();
    this.construirEdificio();
    this.construirEstantes();
    this.construirZonas();

    // Marca de piso bajo el estante de aceites: el estante en alerta «brilla» en ámbar.
    const aceites = CATEGORIAS.find((c) => c.codigo === "ACE")!;
    this.marcaAlerta = new THREE.Mesh(
      new THREE.PlaneGeometry(ESTANTE.ancho + 0.8, ESTANTE.fondo + 0.8),
      new THREE.MeshBasicMaterial({ color: paleta.ambar, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.marcaAlerta.rotation.x = -Math.PI / 2;
    this.marcaAlerta.position.set(aceites.x, 0.012, aceites.z);
    this.escena.add(this.marcaAlerta);

    this.resaltado = new THREE.Mesh(
      new THREE.PlaneGeometry(ESTANTE.ancho + 0.5, ESTANTE.fondo + 0.5),
      new THREE.MeshBasicMaterial({ color: paleta.teal, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.resaltado.rotation.x = -Math.PI / 2;
    this.resaltado.visible = false;
    this.escena.add(this.resaltado);

    this.ruta = new THREE.CatmullRomCurve3(RUTA_DESPACHO.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
    this.montacargas = montacargas(this.material);
    this.pedido = carga(this.material, "teal-100", "teal-700");
    this.escena.add(this.montacargas, this.pedido);

    this.observadorTamano = new ResizeObserver(() => this.redimensionar());
    this.observadorTamano.observe(contenedor);
    this.observadorVista = new IntersectionObserver(([e]) => {
      this.enVista = e.isIntersecting;
      this.actualizarBucle();
    });
    this.observadorVista.observe(contenedor);
    document.addEventListener("visibilitychange", this.alCambiarPestana);
    lienzo.addEventListener("pointermove", this.alMoverPuntero);
    lienzo.addEventListener("pointerleave", this.alSalirPuntero);

    this.redimensionar();
    this.animarObjetos(0);
    this.actualizarBucle();
  }

  // ——— API pública ———

  registrarEtiquetas(etiquetas: Etiqueta[]) {
    this.etiquetas = etiquetas;
    this.pedirCuadro();
  }

  /** Posición del recorrido: 0 = portada, 1–3 = estaciones (admite fracciones). */
  irA(estacion: number) {
    this.estacionObjetivo = estacion;
    if (this.reducido) {
      // Sin animación: la cámara corta directamente a la estación más cercana.
      const destino = Math.round(estacion);
      if (destino !== this.estacion) {
        this.estacion = destino;
        this.pedirCuadro();
      }
    }
  }

  destruir() {
    cancelAnimationFrame(this.raf);
    this.observadorTamano.disconnect();
    this.observadorVista.disconnect();
    document.removeEventListener("visibilitychange", this.alCambiarPestana);
    const lienzo = this.renderer.domElement;
    lienzo.removeEventListener("pointermove", this.alMoverPuntero);
    lienzo.removeEventListener("pointerleave", this.alSalirPuntero);
    const materiales = new Set<THREE.Material>();
    this.escena.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materiales.add(m));
      }
      if (o instanceof THREE.DirectionalLight) o.shadow.dispose();
    });
    materiales.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    lienzo.remove();
    this.etiquetas = [];
  }

  // ——— Construcción ———

  private material = (token: Token) => {
    let m = this.materiales.get(token);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color: this.paleta[token] });
      this.materiales.set(token, m);
    }
    return m;
  };

  private iluminar() {
    const p = this.paleta;
    this.escena.add(new THREE.HemisphereLight(p.blanco, p["marino-200"], 2.1));
    const sol = new THREE.DirectionalLight(p.blanco, 1.7);
    sol.position.set(-6, 22, 14);
    sol.target.position.set(1, 0, 0);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const s = sol.shadow.camera;
    s.left = -22;
    s.right = 22;
    s.top = 16;
    s.bottom = -16;
    s.near = 1;
    s.far = 60;
    sol.shadow.bias = -0.0006;
    sol.shadow.normalBias = 0.03;
    this.escena.add(sol, sol.target);
  }

  /** Combina las piezas estáticas por color: pocas llamadas de dibujo para todo el edificio. */
  private combinar(piezas: Piezas, sombra = true) {
    piezas.forEach((geometrias, token) => {
      const unidas = mergeGeometries(geometrias, false);
      geometrias.forEach((g) => g.dispose());
      if (!unidas) return;
      const malla = new THREE.Mesh(unidas, this.material(token));
      malla.castShadow = sombra;
      malla.receiveShadow = true;
      this.escena.add(malla);
    });
  }

  private construirEdificio() {
    const piezas: Piezas = new Map();
    const { x0, x1, z0, z1 } = PISO;
    const anchoPiso = x1 - x0;
    const fondoPiso = z1 - z0;
    // Losa: base marino y piso blanco encima.
    agregar(piezas, "marino-200", caja(anchoPiso + 0.4, 0.5, fondoPiso + 0.4, 0, -0.26, 0));
    agregar(piezas, "blanco", caja(anchoPiso, 0.04, fondoPiso, 0, 0, 0));
    // Patio de maniobras de los camiones.
    agregar(piezas, "marino-100", caja(8.5, 0.2, 17, x1 + 4.45, -0.12, -0.5));
    // Muros bajos (fondo e izquierda) para leer el interior en corte.
    const altoMuro = 2.3;
    agregar(piezas, "marino-600", caja(anchoPiso, altoMuro, 0.3, 0, altoMuro / 2, z0 - 0.15));
    agregar(piezas, "marino-600", caja(0.3, altoMuro, fondoPiso + 0.3, x0 - 0.15, altoMuro / 2, -0.15));
    agregar(piezas, "marino", caja(anchoPiso + 0.34, 0.12, 0.42, 0, altoMuro + 0.06, z0 - 0.15));
    agregar(piezas, "marino", caja(0.42, 0.12, fondoPiso + 0.34, x0 - 0.15, altoMuro + 0.06, -0.15));
    // Columnas del muro del fondo.
    for (let x = x0 + 4; x < x1; x += 5) agregar(piezas, "marino", caja(0.4, altoMuro + 0.2, 0.2, x, (altoMuro + 0.2) / 2, z0 + 0.1));
    // Pasillos marcados en el piso.
    agregar(piezas, "marino-100", caja(14.6, 0.012, 0.08, -3.5, 0.03, -2.3), caja(14.6, 0.012, 0.08, -3.5, 0.03, 1.2));
    // Ruta de despacho (verde azulado) desde los estantes hasta el andén.
    const ruta = RUTA_DESPACHO;
    for (let i = 0; i < ruta.length - 1; i++) {
      const [ax, az] = ruta[i];
      const [bx, bz] = ruta[i + 1];
      const largo = Math.hypot(bx - ax, bz - az);
      const tramo = caja(largo + 0.4, 0.014, 0.34, 0, 0, 0);
      tramo.rotateY(-Math.atan2(bz - az, bx - ax));
      tramo.translate((ax + bx) / 2, 0.035, (az + bz) / 2);
      agregar(piezas, "teal", tramo);
    }
    this.combinar(piezas);
  }

  private construirEstantes() {
    const piezas: Piezas = new Map();
    const normales: { x: number; y: number; z: number; s: [number, number, number]; token: Token }[] = [];
    const alertas: { x: number; y: number; z: number; s: [number, number, number]; protagonista: boolean }[] = [];

    CATEGORIAS.forEach((c: Categoria, i) => {
      estante(piezas, c.x, c.z, ESTANTE.ancho, ESTANTE.fondo, ESTANTE.alto, ESTANTE.niveles, c.codigo === "ACE" ? "ambar" : "marino");
      for (const p of ubicarProductos(c)) {
        const s = TAMANO_CAJA[p.unidad];
        if (p.alerta) alertas.push({ x: p.x, y: p.y, z: p.z, s, protagonista: c.codigo === "ACE" });
        else normales.push({ x: p.x, y: p.y, z: p.z, s, token: p.unidad === "CAJA" ? "marino-500" : p.unidad === "SACO" ? "marino-100" : "marino-200" });
      }
      // Volumen invisible para detectar el puntero sobre el estante.
      const zona = new THREE.Mesh(
        new THREE.BoxGeometry(ESTANTE.ancho, ESTANTE.alto, ESTANTE.fondo + 0.2),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      zona.position.set(c.x, ESTANTE.alto / 2, c.z);
      zona.userData.indice = i;
      this.escena.add(zona);
      this.zonasEstante.push(zona);
    });
    this.combinar(piezas);

    // Cajas instanciadas: una instancia por producto real del seed (60 en total).
    const cubo = new THREE.BoxGeometry(1, 1, 1);
    const blanco = new THREE.MeshLambertMaterial({ color: this.paleta.blanco });
    const cajas = new THREE.InstancedMesh(cubo, blanco, normales.length);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    normales.forEach((n, i) => {
      m.makeScale(...n.s).setPosition(n.x, n.y, n.z);
      cajas.setMatrixAt(i, m);
      cajas.setColorAt(i, color.set(this.paleta[n.token]));
    });
    cajas.castShadow = true;
    cajas.receiveShadow = true;
    this.escena.add(cajas);

    for (const protagonista of [true, false]) {
      const grupo = alertas.filter((a) => a.protagonista === protagonista);
      const malla = new THREE.InstancedMesh(
        cubo.clone(),
        protagonista ? this.materialAlerta : this.materialAlertaSecundaria,
        grupo.length,
      );
      grupo.forEach((n, i) => {
        m.makeScale(...n.s).setPosition(n.x, n.y, n.z);
        malla.setMatrixAt(i, m);
      });
      malla.castShadow = true;
      this.escena.add(malla);
    }
  }

  private construirZonas() {
    const piezas: Piezas = new Map();
    const { anden, recepcion, escritorio } = ZONAS;
    // Andén de despacho y zona de recepción.
    agregar(piezas, "teal", caja(anden.x1 - anden.x0, 0.22, anden.z1 - anden.z0, (anden.x0 + anden.x1) / 2, 0.11, (anden.z0 + anden.z1) / 2));
    agregar(piezas, "teal-700", caja(0.3, 0.26, anden.z1 - anden.z0, anden.x1 - 0.15, 0.13, (anden.z0 + anden.z1) / 2));
    agregar(piezas, "marino-100", caja(recepcion.x1 - recepcion.x0, 0.16, recepcion.z1 - recepcion.z0, (recepcion.x0 + recepcion.x1) / 2, 0.08, (recepcion.z0 + recepcion.z1) / 2));
    agregar(piezas, "marino-500", caja(0.3, 0.2, recepcion.z1 - recepcion.z0, recepcion.x1 - 0.15, 0.1, (recepcion.z0 + recepcion.z1) / 2));
    // Topes del andén en marino oscuro: el ámbar queda reservado a las alertas.
    for (const z of [anden.z0 + 0.8, anden.z1 - 0.8]) agregar(piezas, "marino-900", caja(0.25, 0.5, 0.5, anden.x1 + 0.1, 0.25, z));
    // Mesa de pedidos: mostrador, monitor y banco.
    const { x, z } = escritorio;
    agregar(piezas, "marino-600", caja(2.6, 0.95, 0.9, x, 0.475, z));
    agregar(piezas, "blanco", caja(2.7, 0.06, 1.0, x, 0.98, z));
    agregar(piezas, "marino-900", caja(0.08, 0.5, 0.7, x + 0.3, 1.3, z), caja(0.2, 0.25, 0.2, x + 0.3, 1.06, z));
    agregar(piezas, "teal-100", caja(0.02, 0.4, 0.6, x + 0.35, 1.3, z));
    agregar(piezas, "marino-500", caja(0.36, 0.08, 0.5, x - 0.5, 1.03, z + 0.1));
    this.combinar(piezas);

    // Pedidos en cola: aprobado (verde azulado) y anulado (coral).
    const aprobado = carga(this.material, "marino-200", "teal-700");
    aprobado.position.set(ZONAS.aprobado.x, 0, ZONAS.aprobado.z);
    const anulado = carga(this.material, "coral", "coral-700");
    anulado.position.set(ZONAS.anulado.x, 0, ZONAS.anulado.z);
    anulado.rotation.y = 0.35;
    // Recepción: lo que llega por la orden de compra sugerida.
    const llegada = carga(this.material, "ambar-100", "marino-500");
    llegada.position.set(ZONAS.palletRecepcion.x, 0.16, ZONAS.palletRecepcion.z);
    const vacia = parihuela(this.material);
    vacia.position.set(ZONAS.palletRecepcion.x - 1.8, 0.16, ZONAS.palletRecepcion.z + 0.8);
    this.escena.add(aprobado, anulado, llegada, vacia);

    const despacho = camion(this.material, "teal");
    despacho.position.set(ZONAS.camionDespacho.x, 0, ZONAS.camionDespacho.z);
    const proveedor = camion(this.material, "marino-500");
    proveedor.position.set(ZONAS.camionProveedor.x, 0, ZONAS.camionProveedor.z);
    this.escena.add(despacho, proveedor);
  }

  // ——— Anclas de etiquetas ———

  private ancla(id: string, destino: THREE.Vector3): THREE.Vector3 {
    if (id.startsWith("estante:")) {
      const c = CATEGORIAS.find((k) => k.codigo === id.slice(8))!;
      return destino.set(c.x, ESTANTE.alto + 0.25, c.z);
    }
    const ace = CATEGORIAS.find((k) => k.codigo === "ACE")!;
    switch (id) {
      case "alerta": {
        // Sobre la caja de ACE-003 (el producto en alerta, en el nivel superior del estante).
        const caja = ubicarProductos(ace).find((p) => p.alerta)!;
        return destino.set(caja.x, caja.y + TAMANO_CAJA[caja.unidad][1] / 2 + 0.05, caja.z);
      }
      case "pedido":
        return this.pedido.visible
          ? destino.copy(this.pedido.position).setY(this.pedido.position.y + 1.25)
          : destino.set(ZONAS.camionDespacho.x - 1.6, 3.1, ZONAS.camionDespacho.z);
      case "escritorio":
        return destino.set(ZONAS.escritorio.x, 1.9, ZONAS.escritorio.z);
      case "aprobado":
        return destino.set(ZONAS.aprobado.x, 1.05, ZONAS.aprobado.z);
      case "anulado":
        return destino.set(ZONAS.anulado.x, 1.05, ZONAS.anulado.z);
      case "salida":
        return destino.set(RUTA_DESPACHO[1][0] + 1.2, 1.2, RUTA_DESPACHO[1][1] + 0.85);
      case "recepcion":
        return destino.set(ZONAS.palletRecepcion.x, 1.6, ZONAS.palletRecepcion.z);
      case "proveedor":
        return destino.set(ZONAS.camionProveedor.x, 2.9, ZONAS.camionProveedor.z);
      default:
        return destino.set(0, 0, 0);
    }
  }

  // ——— Bucle ———

  private actualizarBucle() {
    const debeCorrer = !this.reducido && this.enVista && this.pestanaVisible;
    if (debeCorrer && !this.raf) {
      this.ultimo = performance.now();
      this.raf = requestAnimationFrame(this.cuadro);
    } else if (!debeCorrer && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.reducido) this.pedirCuadro();
  }

  private cuadroPendiente = 0;
  /** Render bajo demanda (modo de movimiento reducido o eventos puntuales). */
  private pedirCuadro() {
    if (this.raf || this.cuadroPendiente) return;
    this.cuadroPendiente = requestAnimationFrame(() => {
      this.cuadroPendiente = 0;
      this.procesarPuntero();
      this.dibujar();
    });
  }

  private cuadro = (ahora: number) => {
    this.raf = requestAnimationFrame(this.cuadro);
    const dt = Math.min((ahora - this.ultimo) / 1000, 0.1);
    this.ultimo = ahora;
    this.reloj += dt;
    if (this.intro < 1) this.intro = Math.min(1, this.intro + dt / 1.8);
    // Amortiguación de la cámara hacia la estación que marca el scroll.
    this.estacion += (this.estacionObjetivo - this.estacion) * (1 - Math.exp(-dt * 5));
    this.animarObjetos(this.reloj);
    this.procesarPuntero();
    this.dibujar();
  };

  private animarObjetos(t: number) {
    if (this.reducido) {
      this.colocarMontacargas(0.42, 0);
      return;
    }
    // Pulso ámbar de los productos en alerta.
    const pulso = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.25);
    this.materialAlerta.emissiveIntensity = 0.3 + 0.45 * pulso;
    (this.marcaAlerta.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.35 * pulso;

    // Ciclo de 10 s: lleva el pedido al camión, lo carga y vuelve en reversa.
    const fase = (t % 10) / 10;
    if (fase < 0.52) this.colocarMontacargas(suave(fase / 0.52), 0);
    else if (fase < 0.66) this.colocarMontacargas(1, suave((fase - 0.52) / 0.14));
    else this.colocarMontacargas(1 - suave((fase - 0.66) / 0.34), 2);
  }

  /** u: avance sobre la ruta; carga: 0 = en las uñas, (0,1) = entrando al camión, 2 = ya cargado. */
  private colocarMontacargas(u: number, carga: number) {
    const p = this.ruta.getPointAt(u);
    const tangente = this.ruta.getTangentAt(u);
    this.montacargas.position.set(p.x, 0.04, p.z);
    this.montacargas.rotation.y = Math.atan2(-tangente.z, tangente.x);
    const frente = this.auxiliar.set(Math.cos(this.montacargas.rotation.y), 0, -Math.sin(this.montacargas.rotation.y));
    const enUnas = { x: p.x + frente.x * 1.12, y: 0.22, z: p.z + frente.z * 1.12 };
    if (carga === 2) {
      this.pedido.visible = false;
      return;
    }
    this.pedido.visible = true;
    this.pedido.rotation.y = this.montacargas.rotation.y;
    if (carga === 0) {
      this.pedido.position.set(enUnas.x, enUnas.y, enUnas.z);
      return;
    }
    const dentro = { x: ZONAS.camionDespacho.x - 0.6, y: 0.62, z: ZONAS.camionDespacho.z };
    this.pedido.position.set(
      THREE.MathUtils.lerp(enUnas.x, dentro.x, carga),
      THREE.MathUtils.lerp(enUnas.y, dentro.y, Math.min(1, carga * 2)),
      THREE.MathUtils.lerp(enUnas.z, dentro.z, carga),
    );
    if (carga > 0.98) this.pedido.visible = false;
  }

  private encuadrar() {
    const compacto = this.ancho < 768;
    const cuadros = compacto ? CUADROS_COMPACTOS : CUADROS_ANCHO;
    const e = THREE.MathUtils.clamp(this.estacion, 0, cuadros.length - 1);
    const i = Math.min(Math.floor(e), cuadros.length - 2);
    const f = suave(e - i);
    const a = cuadros[i];
    const b = cuadros[i + 1];
    const mezcla = (u: number, v: number) => u + (v - u) * f;
    const objetivo = new THREE.Vector3(
      mezcla(a.objetivo[0], b.objetivo[0]),
      mezcla(a.objetivo[1], b.objetivo[1]),
      mezcla(a.objetivo[2], b.objetivo[2]),
    );
    const aspecto = this.ancho / this.alto;
    const acercamiento = 1 + 0.16 * (1 - (1 - Math.pow(1 - this.intro, 3)));
    const mitadAlto = Math.max(mezcla(a.alto, b.alto) / 2, mezcla(a.ancho, b.ancho) / 2 / aspecto) * acercamiento;
    const mitadAncho = mitadAlto * aspecto;
    const dx = mezcla(a.dx, b.dx);
    const dy = mezcla(a.dy, b.dy);
    const c = this.camara;
    c.left = -mitadAncho - dx * 2 * mitadAncho;
    c.right = mitadAncho - dx * 2 * mitadAncho;
    c.top = mitadAlto - dy * 2 * mitadAlto;
    c.bottom = -mitadAlto - dy * 2 * mitadAlto;
    c.position.copy(objetivo).addScaledVector(DIRECCION, 60);
    c.lookAt(objetivo);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  private dibujar() {
    this.encuadrar();
    this.renderer.render(this.escena, this.camara);
    this.ubicarEtiquetas();
  }

  private ubicarEtiquetas() {
    const v = this.auxiliar;
    const e = this.estacion;
    for (const et of this.etiquetas) {
      let opacidad = 0;
      for (const k of et.estaciones) opacidad = Math.max(opacidad, 1 - Math.abs(e - k) * 2.2);
      opacidad = THREE.MathUtils.clamp(opacidad, 0, 1);
      this.ancla(et.ancla, v).project(this.camara);
      let mitad = this.anchos.get(et.el);
      if (mitad === undefined) {
        mitad = et.el.querySelector<HTMLElement>("[data-chip]")?.offsetWidth ?? 0;
        this.anchos.set(et.el, mitad);
      }
      // Las etiquetas se mantienen dentro del lienzo aunque su ancla quede cerca del borde.
      const [dx, oy] = (this.ancho < 768 ? (et.desfaseMovil ?? et.desfase) : et.desfase) ?? [0, 0];
      // El ancla queda sobre el objeto; el chip se desplaza (abanico) y una línea guía lo une al ancla.
      const x = ((v.x + 1) / 2) * this.ancho;
      const y = ((1 - v.y) / 2) * this.alto;
      const centro = THREE.MathUtils.clamp(x + dx, mitad / 2 + 8, Math.max(mitad / 2 + 8, this.ancho - mitad / 2 - 8));
      const ox = centro - x;
      const fuera = centro < -40 || centro > this.ancho + 40 || y < -40 || y > this.alto + 40;
      et.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      this.colocarChip(et.el, ox, oy);
      et.el.style.opacity = fuera ? "0" : opacidad.toFixed(3);
      et.el.style.visibility = fuera || opacidad < 0.02 ? "hidden" : "visible";
    }
    if (this.globo) {
      if (this.estanteActivo === null) {
        this.globo.style.visibility = "hidden";
      } else {
        const c = CATEGORIAS[this.estanteActivo];
        this.ancla(`estante:${c.codigo}`, v).project(this.camara);
        const x = ((v.x + 1) / 2) * this.ancho;
        const y = ((1 - v.y) / 2) * this.alto;
        this.globo.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - 30).toFixed(1)}px, 0)`;
        this.globo.style.visibility = "visible";
      }
    }
  }

  /** Coloca el chip con su desfase y traza la línea guía desde el ancla hasta el borde del chip. */
  private colocarChip(el: HTMLElement, ox: number, oy: number) {
    const chip = el.querySelector<HTMLElement>("[data-chip]");
    const guia = el.querySelector<HTMLElement>("[data-guia]");
    if (!chip) return;
    const desfasada = Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5;
    chip.toggleAttribute("data-desfasada", desfasada);
    // Arriba del ancla: el chip apoya su borde inferior; abajo: su borde superior.
    const abajo = oy > 0;
    chip.style.transform = abajo
      ? `translate(calc(-50% + ${ox.toFixed(1)}px), ${oy.toFixed(1)}px)`
      : `translate(calc(-50% + ${ox.toFixed(1)}px), calc(-100% - 6px + ${oy.toFixed(1)}px))`;
    if (!guia) return;
    if (!desfasada) {
      guia.style.visibility = "hidden";
      return;
    }
    const fx = ox;
    const fy = abajo ? oy : oy - 6;
    guia.style.visibility = "inherit";
    guia.style.width = `${Math.hypot(fx, fy).toFixed(1)}px`;
    guia.style.transform = `rotate(${Math.atan2(fy, fx).toFixed(4)}rad)`;
  }

  // ——— Puntero: al pasar sobre un estante se muestra su categoría y su conteo ———

  private alMoverPuntero = (ev: PointerEvent) => {
    if (ev.pointerType === "touch") return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.punteroDentro = true;
    this.punteroPendiente = true;
    this.pedirCuadro();
  };

  private alSalirPuntero = () => {
    this.punteroDentro = false;
    this.punteroPendiente = true;
    this.pedirCuadro();
  };

  private procesarPuntero() {
    if (!this.punteroPendiente) return;
    this.punteroPendiente = false;
    let indice: number | null = null;
    if (this.punteroDentro) {
      this.encuadrar();
      this.raycaster.setFromCamera(this.puntero, this.camara);
      const hit = this.raycaster.intersectObjects(this.zonasEstante, false)[0];
      if (hit) indice = hit.object.userData.indice as number;
    }
    if (indice === this.estanteActivo) return;
    this.estanteActivo = indice;
    if (indice === null) {
      this.resaltado.visible = false;
    } else {
      const c = CATEGORIAS[indice];
      this.resaltado.position.set(c.x, 0.02, c.z);
      this.resaltado.visible = true;
      if (this.globo) {
        const n = c.unidades.length;
        const nombre = this.globo.querySelector<HTMLElement>("[data-nombre]");
        const detalle = this.globo.querySelector<HTMLElement>("[data-detalle]");
        if (nombre) nombre.textContent = `${c.codigo} · ${c.nombre}`;
        if (detalle) detalle.textContent = `${n} productos${c.alerta !== null ? " · 1 en alerta" : " · sin alertas"}`;
      }
    }
  }

  private alCambiarPestana = () => {
    this.pestanaVisible = !document.hidden;
    this.actualizarBucle();
  };

  private redimensionar() {
    const { clientWidth, clientHeight } = this.contenedor;
    if (!clientWidth || !clientHeight) return;
    this.ancho = clientWidth;
    this.alto = clientHeight;
    this.anchos.clear();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight);
    this.pedirCuadro();
    if (this.raf) return;
    this.dibujar();
  }
}

/** Comprueba si el navegador puede crear un contexto WebGL. */
export function hayWebGL(): boolean {
  try {
    const lienzo = document.createElement("canvas");
    const gl = lienzo.getContext("webgl2") ?? lienzo.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
