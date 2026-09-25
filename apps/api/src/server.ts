import { config } from "./config.ts";
import { crearApp } from "./app.ts";

crearApp().listen(config.puerto, () => {
  console.log(`API de SIGPI escuchando en http://localhost:${config.puerto}/api`);
});
