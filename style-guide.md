# Universal Style Guide

This document describes rules that should be applied to **all** languages.

NOTE TO MAINTAINERS: You may want to translate this guide so that it can be more accessible to your translators.

## Heading IDs

All headings have explicit IDs like this:

```md
## Getting Started {#getting-started}
```

Do **not** translate these IDs! They are used for navigation and will break if the document is referred to externally, i.e.:

```md
See the [beginning section](/feature#getting-started) for more information.
```

✅ DO:

```md
## Primeros Pasos {#getting-started}
```

❌ DON'T:

```md
## Primeros Pasos {#primeros-pasos}
```

This will break the link above.

## Text in Code Blocks

Leave text in code blocks untranslated except for comments. You may optionally translate text in strings, but be careful not to translate strings that refer to code!

Example:
```js
// Example
try {
  const product = await updateProjectMutation({ name: 'Cool Shoes' })
  setQueryData(product)
} catch (error) {
  alert("Error saving product")
}
```

✅ DO:

```js
// Ejemplo
try {
  const product = await updateProductMutation({ name: 'Cool Shoes' })
  setQueryData(product)
} catch (error) {
  alert("Error saving product")
}
```

✅ ALSO OKAY:

```js
// Ejemplo
try {
  const product = await updateProductMutation({ name: 'Zapatazos' })
  setQueryData(product)
} catch (error) {
  alert("rror al guardar el producto")
}
```

❌ DON'T:

```js
// Ejemplo
try {
  const producto = await updateProductoMutation({ name: 'Zapatazos' })
  setQueryData(producto)
} catch (error) {
  alert("rror al guardar el producto")
}
```

❌ DEFINITELY DON'T:

```js
// Ejemplo
try {
  const producto = await mutacionActualizarProducto({ nombre: 'Zapatazos' })
  actualizarDatosDeLaPeticion(product)
} catch (error) {
  alerta("Error al guardar el producto")
}
```

## External Links

If an external link is to an article in a reference like [MDN] or [Wikipedia], and a version of that article exists in your language that is of decent quality, consider linking to that version instead.

[MDN]: https://developer.mozilla.org/en-US/
[Wikipedia]: https://en.wikipedia.org/wiki/Main_Page

Example:

```md
Some elements are [immutable](https://en.wikipedia.org/wiki/Immutable_object).
```

✅ OK:

```md
Algunos elementos son [inmutables](https://es.wikipedia.org/wiki/Objeto_inmutable).
```

For links that have no equivalent (Stack Overflow, YouTube videos, etc.), just use the English link.