(() => {
  const panel = document.querySelector('.modal-image-panel');
  const image = document.getElementById('modal-image');
  const zoomIn = document.getElementById('image-zoom-in');
  const zoomOut = document.getElementById('image-zoom-out');
  const resetButton = document.getElementById('image-zoom-reset');

  if (!panel || !image || !zoomIn || !zoomOut || !resetButton) return;

  const pointers = new Map();
  let scale = 1;
  let x = 0;
  let y = 0;
  let dragOrigin = null;
  let pinchDistance = 0;
  let pinchScale = 1;

  function clampPosition() {
    const maxX = panel.clientWidth * (scale - 1) / 2;
    const maxY = panel.clientHeight * (scale - 1) / 2;
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
  }

  function render() {
    clampPosition();
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    panel.classList.toggle('is-zoomed', scale > 1);
    zoomOut.disabled = scale <= 1;
    zoomIn.disabled = scale >= 4;
  }

  function setScale(nextScale) {
    scale = Math.max(1, Math.min(4, nextScale));
    if (scale === 1) {
      x = 0;
      y = 0;
    }
    render();
  }

  function reset() {
    scale = 1;
    x = 0;
    y = 0;
    pointers.clear();
    dragOrigin = null;
    pinchDistance = 0;
    render();
  }

  function distanceBetweenPointers() {
    const [first, second] = [...pointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  zoomIn.addEventListener('click', () => setScale(scale + 0.5));
  zoomOut.addEventListener('click', () => setScale(scale - 0.5));
  resetButton.addEventListener('click', reset);
  image.addEventListener('load', reset);

  panel.addEventListener('wheel', (event) => {
    if (event.target.closest('.image-zoom-controls')) return;
    event.preventDefault();
    setScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });

  panel.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.image-zoom-controls')) return;
    panel.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1 && scale > 1) {
      dragOrigin = { pointerX: event.clientX, pointerY: event.clientY, imageX: x, imageY: y };
      panel.classList.add('is-dragging');
    } else if (pointers.size === 2) {
      pinchDistance = distanceBetweenPointers();
      pinchScale = scale;
      dragOrigin = null;
    }
  });

  panel.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const distance = distanceBetweenPointers();
      if (pinchDistance > 0) setScale(pinchScale * distance / pinchDistance);
    } else if (dragOrigin && scale > 1) {
      x = dragOrigin.imageX + event.clientX - dragOrigin.pointerX;
      y = dragOrigin.imageY + event.clientY - dragOrigin.pointerY;
      render();
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    dragOrigin = null;
    panel.classList.remove('is-dragging');

    if (pointers.size === 1 && scale > 1) {
      const remaining = [...pointers.values()][0];
      dragOrigin = { pointerX: remaining.x, pointerY: remaining.y, imageX: x, imageY: y };
    }
  }

  panel.addEventListener('pointerup', releasePointer);
  panel.addEventListener('pointercancel', releasePointer);
  panel.addEventListener('lostpointercapture', releasePointer);
  window.addEventListener('resize', render);

  reset();
})();
