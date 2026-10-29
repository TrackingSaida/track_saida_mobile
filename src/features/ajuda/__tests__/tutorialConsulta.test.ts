import assert from "node:assert/strict";
import { listarTutoriais } from "../catalogo";
import {
  categoriasVisiveis,
  duracaoPorExtenso,
  filtrarTutoriais,
  formatarDuracao,
  normalizarPapel,
  tutoriaisDoPerfil,
} from "../tutorialConsulta";
import { hostYouTubeValido, urlsDoVideo } from "../youtube";

const catalogo = listarTutoriais();

assert.equal(catalogo.length, 1);
assert.equal(catalogo[0]?.youtubeVideoId, "1Omc16c6088");
assert.deepEqual(catalogo[0]?.perfis, [4]);
assert.equal(catalogo[0]?.duracaoSegundos, 97);

assert.equal(formatarDuracao(97), "1:37");
assert.equal(duracaoPorExtenso(97), "1 minuto e 37 segundos");

const motoboy = tutoriaisDoPerfil(catalogo, 4);
const staff = tutoriaisDoPerfil(catalogo, 2);
assert.equal(motoboy.length, 1);
assert.equal(tutoriaisDoPerfil(catalogo, normalizarPapel("4")).length, 1);
assert.equal(staff.length, 0);
assert.equal(tutoriaisDoPerfil(catalogo, normalizarPapel("2")).length, 0);
assert.deepEqual(categoriasVisiveis(motoboy), ["rotas"]);
assert.deepEqual(categoriasVisiveis(staff), []);

assert.equal(filtrarTutoriais(motoboy, { categoria: "todos", busca: "rota" }).length, 1);
assert.equal(filtrarTutoriais(motoboy, { categoria: "todos", busca: "ROTA" }).length, 1);
assert.equal(filtrarTutoriais(motoboy, { categoria: "todos", busca: "preparar" }).length, 1);
assert.equal(filtrarTutoriais(motoboy, { categoria: "todos", busca: "preparação" }).length, 1);
assert.equal(filtrarTutoriais(motoboy, { categoria: "rotas", busca: "" }).length, 1);
assert.equal(filtrarTutoriais(motoboy, { categoria: "entregas", busca: "" }).length, 0);
assert.equal(filtrarTutoriais(motoboy, { categoria: "todos", busca: "zzzz" }).length, 0);

const urls = urlsDoVideo("1Omc16c6088");
assert.equal(urls?.principal, "https://www.youtube.com/shorts/1Omc16c6088");
assert.equal(urls?.reserva, "https://www.youtube.com/watch?v=1Omc16c6088");
assert.equal(urls?.miniatura, "https://i.ytimg.com/vi/1Omc16c6088/hqdefault.jpg");
assert.equal(hostYouTubeValido(urls?.principal ?? ""), true);
assert.equal(urlsDoVideo("curto"), null);
assert.equal(urlsDoVideo("não-é-id!!"), null);

console.log("tutorialConsulta tests OK");
