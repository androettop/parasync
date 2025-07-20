# ✅ Especificación de `config.yaml` (vFinal)

---

## 🎯 Propósito

Un archivo YAML declarativo que define cómo integrar y adaptar una API externa de canciones a tu sistema, utilizando expresiones dinámicas basadas en `expr-eval`.

---

## 📦 Estructura general

```yaml
name: <string>                 # Nombre legible del repositorio/API

search_url: <string>          # URL completa como una expresión (con ~)

headers:                      # Lista opcional de headers HTTP
  - <header_key>: <string>    # Puede ser fijo o expresión (~...)

response:
  data_path: <string>         # Ruta al arreglo de canciones en el JSON
  serializer: "none" | "msgpackr"  # Default = "none"
  fields:                     # Mapeo de cada canción a tu formato interno
    <output_field>: <string>  # Expr-eval si comienza con ~
```

---

## 🧠 Evaluación de expresiones

Cualquier string que **comience con `~`** se interpreta como una **expresión de `expr-eval`**.

### 🔹 En `search_url` y `headers`

Variables disponibles:

| Nombre          | Significado                          |
| --------------- | ------------------------------------ |
| `query`         | Término de búsqueda                  |
| `page`          | Número de página (desde 1)           |
| `pageSize`      | Resultados por página (default 20)   |
| `sortBy`        | Campo de ordenamiento lógico interno |
| `sortDirection` | `"asc"` o `"desc"`                   |
| `env`           | Objeto con variables de entorno      |

### 🔹 En `response.fields`

- Solo está disponible la variable `song` (el objeto individual de la canción)
- También se puede acceder a `env` si fuera necesario

---

## 🔣 Funciones soportadas en expresiones

- **Predefinidas por `expr-eval`**:
  `roundTo`, `min`, `max`, `join`, `if`, `encodeURIComponent`, etc.

- **Personalizadas**:

### `case(value, keys[], values[], fallback?)`

Simula un `switch`:

```yaml
case(sortBy, ['artist', 'title'], ['author', 'name'], 'submissionDate')
```

---

## 🧪 Ejemplo completo

```yaml
name: ParaDB

search_url: |
  ~'https://paradb.net/api/maps?' ||
  'query=' || encodeURIComponent(query) ||
  '&limit=' || pageSize ||
  '&offset=' || ((page - 1) * pageSize) ||
  '&sort=' || case(
    sortBy,
    ['artist', 'title', 'duration'],
    ['author', 'name', 'length'],
    'submissionDate'
  ) ||
  '&order=' || sortDirection

headers:
  - x-api-key: "~env.API_KEY"
  - Accept: "application/json"

response:
  songs_array: "~response.maps"
  serializer: "none"

  fields:
    id: "~song.id"
    title: "~song.metadata.title"
    artist: "~song.artist.name"
    coverUrl: "~'https://paradb.net/covers/' || song.id"
    durationMinutes: "~roundTo(song.duration / 60, 2)"
    slug: "~song.artist.name || '-' || song.metadata.title"
```

---

## 🔁 Flujo de procesamiento

1. Cargar `config.yaml`
2. Evaluar `search_url` si comienza con `~` usando contexto:

   ```js
   {
     (query, page, pageSize, sortBy, sortDirection, env);
   }
   ```

3. Evaluar cada header si comienza con `~`
4. Realizar la request (GET)
5. Decodificar la respuesta con `serializer`
6. Usar `data_path` para extraer el arreglo de canciones
7. Para cada canción:
   - Evaluar cada campo en `fields` con `{ song, env }`

8. Resultado final: array de canciones normalizadas

---

## ✅ Ventajas

- Totalmente declarativo
- Flexible con expresiones seguras
- Compatible con múltiples APIs heterogéneas
- Reutilizable para endpoints REST complejos
