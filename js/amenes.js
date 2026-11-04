// 7 Amenes de la Madrugada — botones de compra y barra fija.
//
// Los botones de compra (a.comprar) llevan a nuestra página de pago
// (checkout.html, con el pago de la Whop embebido). Aquí solo les sumamos
// las etiquetas del anuncio (utm_…, fbclid), para saber qué anuncio vendió.

(function () {
  var etiquetas = new URLSearchParams(window.location.search);
  document.querySelectorAll("a.comprar").forEach(function (a) {
    var destino = new URL(a.getAttribute("href"), window.location.href);
    etiquetas.forEach(function (valor, nombre) {
      if (/^utm_|^fbclid$/.test(nombre) && !destino.searchParams.has(nombre)) {
        destino.searchParams.set(nombre, valor);
      }
    });
    a.href = destino.toString();
  });

  // La barra fija aparece después de la portada y se esconde en el precio,
  // para no tener dos botones iguales en la pantalla.
  var barra = document.querySelector(".barra-compra");
  var portada = document.querySelector(".portada");
  var precio = document.getElementById("precio");
  if (!barra || !portada || !("IntersectionObserver" in window)) return;
  var pasoPortada = false, viendoPrecio = false;
  function actualizar() { barra.classList.toggle("visible", pasoPortada && !viendoPrecio); }
  new IntersectionObserver(function (e) { pasoPortada = !e[0].isIntersecting; actualizar(); }).observe(portada);
  if (precio) new IntersectionObserver(function (e) { viendoPrecio = e[0].isIntersecting; actualizar(); }).observe(precio);
})();
