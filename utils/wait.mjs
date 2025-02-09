/**
 * Attendu que le délai soit atteint pour appeler continuer l’exécution
 */
export default function wait(delay) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delay);
  });
}
