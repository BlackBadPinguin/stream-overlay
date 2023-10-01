/**
 *
 * @param {string} path
 * @param {number} volume
 * @returns {void}
 */
function playAudio(path, volume = 0.9) {
  const audio = new Audio(path);
  if (!audio) return;
  audio.volume = volume;
  audio.play();
}
