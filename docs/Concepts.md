# Manual de Conceptos Técnicos y Guía de Búsqueda Rápida para Entrevista con Manager (`Concepts.md`)

**Propósito**: Referencia técnica concisa, estructurada y de búsqueda rápida (`Cmd+F`) diseñada para la entrevista técnica con el Engineering Manager / Director de Tecnología.

---

## 📋 Tabla de Contenidos Rápida

1. [TypeScript & Node.js](#1-typescript--nodejs)
2. [NestJS](#2-nestjs)
3. [React & Next.js](#3-react--nextjs)
4. [Python & FastAPI](#4-python--fastapi)
5. [Docker & Kubernetes (K8s)](#5-docker--kubernetes-k8s)
6. [DDD (Domain-Driven Design)](#6-ddd-domain-driven-design)
7. [EDD (Event-Driven Development)](#7-edd-event-driven-development)
8. [DevOps, Git & GitHub Actions](#8-devops-git--github-actions)
9. [Patrones de Diseño (GoF) y Casos Específicos](#9-patrones-de-diseño-gof-y-casos-específicos)
10. [Patrones de Arquitectura](#10-patrones-de-arquitectura)

---

## 1. TypeScript & Node.js

### 💡 Conceptos Clave & Definiciones Concisas
- **Event Loop**: Bucle monohilo no bloqueante de Node.js que delega operaciones I/O a `libuv`.
- **Microtask vs Macrotask**:
  - *Microtask*: `Promise.then()`, `process.nextTick()`, `queueMicrotask()`. Tienen prioridad máxima y se ejecutan antes del siguiente ciclo del Event Loop.
  - *Macrotask*: `setTimeout()`, `setInterval()`, `setImmediate()`, eventos I/O.
- **Utility Types**:
  - `Partial<T>` (todos opcionales), `Required<T>` (todos obligatorios), `Readonly<T>` (inmutables).
  - `Record<K, T>` (mapa de clave-valor), `Pick<T, K>` (selecciona propiedades), `Omit<T, K>` (elimina propiedades).
- **Discriminated Unions**: Patrón en TypeScript con una propiedad común (ej. `type: 'success' | 'error'`) para que el compilador reduzca tipos automáticamente (*Type Narrowing*).
- **Streams vs Buffers**:
  - *Buffer*: Carga todo el bloque de datos en memoria RAM antes de procesarlo.
  - *Stream*: Procesa datos en trozos (*chunks*) continuos de tamaño acotado. (Tipos: `Readable`, `Writable`, `Transform`, `Duplex`).

### ✅ Buenas Prácticas
- Habilitar `strict: true` en `tsconfig.json` y prohibir el uso de `any` (usar `unknown` + Type Guards).
- Usar `Stream.pipeline()` para evitar fuga de memoria durante transferencia de archivos grandes.

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Cómo detectas y previenes Memory Leaks en Node.js?**
  - **A**: Diagnóstico con Heap Snapshots (`node --inspect`) y métricas de memoria `process.memoryUsage()`. Principales causas: Event Listeners sin des-registrar (`EventEmitter.on`), referencias globales no limpiadas, y cierres (*closures*) reteniendo objetos pesados.
- **Q: ¿Cuándo usaría `unknown` sobre `any`?**
  - **A**: `unknown` es el equivalente seguro de `any`. Obliga a realizar validación de tipo (*Type Guard*) antes de realizar cualquier operación sobre la variable.

---

## 2. NestJS

### 💡 Conceptos Clave & Definiciones Concisas
- **Inyección de Dependencias (DI) & IoC**: El contenedor de NestJS gestiona la instanciación y vida de las dependencias via decorador `@Injectable()`.
- **Scopes de Providers**:
  - `DEFAULT` (Singleton): 1 instancia global para toda la aplicación (alto rendimiento).
  - `REQUEST`: 1 instancia nueva por cada petición HTTP (útil para multitenancy, pero consume más memoria).
  - `TRANSIENT`: 1 instancia nueva por cada inyección.
- **Componentes de la Petición**:
  - *Middleware*: Modifica `req`/`res` antes del enrutamiento.
  - *Guards*: Autorización y autenticación (`CanActivate`).
  - *Interceptors*: Bindean lógica antes y después del controlador (RxJS).
  - *Pipes*: Validación y transformación de payloads DTO (`PipeTransform`).
  - *Exception Filters*: Mapeo centralizado de errores a respuestas HTTP.

### ✅ Buenas Prácticas
- Usar `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true` para descartar propiedades no definidas en los DTOs.
- Estructurar en **Monolito Modular** desacoplado para facilitar migración futura a microservicios.

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Cómo evitas degrado de rendimiento si usas `REQUEST` Scope en NestJS?**
  - **A**: Limitar su uso exclusivamente a los servicios que requieren datos del request (ej. Tenant ID). El resto del árbol de dependencias debe mantenerse en `DEFAULT` (Singleton).

---

## 3. React & Next.js

### 💡 Conceptos Clave & Definiciones Concisas
- **Virtual DOM & Reconciliation (Fiber)**: Algoritmo de diferenciación (*diffing*) de React que compara el árbol VDOM en memoria con el DOM real para aplicar solo los cambios mínimos necesarios.
- **Renderizado en Next.js (App Router)**:
  - *Server Components (RSC)*: Se renderizan exclusivamente en el servidor; 0 KB de JavaScript enviado al cliente.
  - *Client Components (`'use client'`)*: Se hidratan en el navegador para interactividad (hooks, eventos).
  - *SSR (Server-Side Rendering)*: Paginas generadas dinámicamente en cada petición.
  - *SSG (Static Site Generation)*: Páginas pre-renderizadas en tiempo de build.
  - *ISR (Incremental Static Regeneration)*: Revalida y actualiza páginas estáticas en segundo plano sin reconstruir todo el sitio.
- **Hooks Esenciales**: `useCallback` (memoriza funciones), `useMemo` (memoriza valores calculados), `useRef` (mantiene referencia mutable sin disparar re-render).

### ✅ Buenas Prácticas
- Mantener los componentes del cliente en las hojas del árbol de componentes (*pushing client state down*).
- Optimizar Core Web Vitals (LCP, INP, CLS) mediante `next/image`, `next/font` y Code Splitting con `React.lazy()` / `dynamic()`.

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Cuándo elegir ISR sobre SSR en Next.js?**
  - **A**: ISR cuando los datos cambian periódicamente pero no por cada usuario (ej. catálogo de e-commerce). Reduce la carga del servidor a cero mientras entrega datos frescos mediante revalidación por tiempo (`revalidate: 60`).

---

## 4. Python & FastAPI

### 💡 Conceptos Clave & Definiciones Concisas
- **GIL (Global Interpreter Lock)**: Mutex en CPython que permite que solo un hilo ejecute bytecode de Python a la vez.
  - *I/O-bound tasks*: Se benefician de `asyncio` o multithreading (el GIL se libera esperando I/O).
  - *CPU-bound tasks*: Requieren `multiprocessing` o librerías en C/Rust para usar múltiples núcleos de CPU.
- **WSGI vs ASGI**:
  - *WSGI* (Gunicorn/uWSGI): Síncrono (Django tradicional, Flask).
  - *ASGI* (Uvicorn): Asíncrono nativo con soporte para WebSockets y concurrencia `async/await` (FastAPI).
- **FastAPI Core**: Basado en **Pydantic** (validación de esquemas y parsing ultra rápido) y **Starlette** (rendimiento ASGI).

### ✅ Buenas Prácticas
- Usar Pydantic v2 para validaciones de datos con tipado estricto y controladores de BD asíncronos (`asyncpg`, `SQLAlchemy async`).

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Por qué FastAPI es significativamente más rápido que Flask/Django?**
  - **A**: Porque funciona sobre el motor ASGI Uvicorn con `asyncio`, realiza serialización/validación de datos compilada en C/Rust mediante Pydantic v2 y no bloquea el hilo principal durante llamadas a DB o APIs externas.

---

## 5. Docker & Kubernetes (K8s)

### 💡 Conceptos Clave & Definiciones Concisas
- **Docker Multi-Stage**: Proceso de compilación que utiliza imágenes temporales para instalar dependencias y construir la app, copiando solo los binarios finales a una imagen ligera (Alpine / Distroless).
- **Kubernetes Primitives**:
  - *Pod*: Unidad mínima ejecutable de K8s (uno o más contenedores).
  - *Deployment*: Controla las réplicas deseables de Pods, rolling updates y autorrecuperación.
  - *Service*: Balanceador de carga e IP estable interna (`ClusterIP`, `NodePort`, `LoadBalancer`).
  - *Ingress*: Enrutador HTTP/HTTPS perimetral hacia los Services.
  - *HPA*: Escala automáticamente Pods según uso de CPU/Memoria o métricas personalizadas.
  - *Probes*:
    - `livenessProbe`: Reinicia el contenedor si está colgado (*deadlock*).
    - `readinessProbe`: Detiene el tráfico al Pod si aún no está listo para recibir peticiones.

### ✅ Buenas Prácticas
- Ejecutar contenedores con usuarios no root (`USER node`).
- Definir siempre `resources.requests` y `resources.limits` en los manifiestos de K8s.

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Qué ocurre si falla la Readiness Probe vs Liveness Probe?**
  - **A**: Si falla `readinessProbe`, K8s remueve el Pod del balanceador de carga (`Service`) sin destruirlo. Si falla `livenessProbe`, K8s mata y vuelve a crear el contenedor.

---

## 6. DDD (Domain-Driven Design)

### 💡 Conceptos Clave & Definiciones Concisas
- **Ubiquitous Language**: Lenguaje común acordado entre desarrolladores y expertos del negocio.
- **Bounded Context**: Límite explícito dentro del cual un modelo de dominio aplica con significado único.
- **Building Blocks**:
  - *Entity*: Objeto con identidad única que perdura en el tiempo (ej. `Order` con `id`).
  - *Value Object*: Objeto inmutable definido solo por sus atributos (ej. `Money(amount, currency)`). Sin identidad propia.
  - *Aggregate*: Conjunto de entidades y objetos de valor tratados como una unidad atómica de datos gestionada por una *Aggregate Root*.
  - *Domain Event*: Hecho inmutable que ocurrió en el dominio (ej. `OrderCreatedEvent`).

### ✅ Buenas Prácticas
- Mantener la capa de Dominio pura (cero dependencias de NestJS, TypeORM, Express o bases de datos).

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Cuál es la diferencia entre un Anemic Domain Model y un Rich Domain Model?**
  - **A**: En el modelo Anémico, las entidades son solo contenedores de datos (`getters/setters`) y la lógica está en los servicios. En el modelo Rico, las entidades contienen las reglas de negocio y validaciones de invariantes dentro de sí mismas.

---

## 7. EDD (Event-Driven Development)

### 💡 Conceptos Clave & Definiciones Concisas
- **Componentes**: Event Producers, Event Consumers, Message Brokers (RabbitMQ, Kafka, AWS SQS).
- **Transactional Outbox Pattern**: Guarda el evento en la base de datos SQL dentro de la misma transacción que modifica la entidad. Un worker externo lee la tabla outbox y envía el evento al broker, previniendo pérdida de eventos ante caídas de red.
- **CQRS**: Separa los modelos de Lectura (*Queries*) y Escritura (*Commands*) para optimizar rendimiento e independizar escalabilidad.
- **Idempotencia**: Garantizar que procesar el mismo evento múltiples veces genere exactamente el mismo resultado que procesarlo una sola vez.

### ✅ Buenas Prácticas
- Usar un esquema de eventos versionado (ej. `v1.OrderCreated`) con compatibilidad hacia atrás.

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Cómo garantizas la entrega de eventos si el Message Broker está caído?**
  - **A**: Mediante el *Transactional Outbox Pattern*. La aplicación guarda la orden y el evento en la misma transacción SQL local. Si el broker cae, el evento permanece seguro en la tabla `outbox` hasta que el worker lo reintente.

---

## 8. DevOps, Git & GitHub Actions

### 💡 Conceptos Clave & Definiciones Concisas
- **Workflows de Git**:
  - *GitFlow*: Ramas de larga duración (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`).
  - *Trunk-Based Development*: Todos los desarrolladores envían pequeñas iteraciones directamente a `main`/`trunk` protegidas por **Feature Flags**. Ideal para CI/CD continuo.
- **GitHub Actions**:
  - *Workflow*: Proceso automatizado en YAML.
  - *Jobs & Steps*: Conjunto de pasos ejecutados en un runner de CI.
  - *Caching*: Reutilización de `node_modules` o imágenes Docker previas para reducir tiempos de build de 10 min a 1 min.

### ✅ Buenas Prácticas
- Proteger la rama `main` requiriendo Pull Requests con aprobación y paso obligatorio de tests de CI.

### 🎙️ Q&A Típica de Entrevista
- **Q: ¿Por qué Trunk-Based Development es preferido en equipos de alto rendimiento sobre GitFlow?**
  - **A**: Elimina el dolor de los "Merge Hells" al integrar código diariamente, permite despliegues continuos múltiples veces al día y fomenta entregas pequeñas desacopladas con Feature Flags.

---

## 9. Patrones de Diseño (GoF) y Casos Específicos

### 💡 Catálogo Rápido de Patrones

#### Creacionales
- **Factory Method**: Delega la instanciación de objetos a subclases según parámetros.
- **Builder**: Construye objetos complejos paso a paso (`new OrderBuilder().addUser(u).addItem(i).build()`).
- **Singleton**: Garantiza una única instancia de una clase en toda la aplicación.

#### Estructurales
- **Adapter**: Convierte la interfaz de una clase en otra esperada por los clientes (ej. envolver pasarelas de pago Stripe/PayPal en `IPaymentAdapter`).
- **Decorator**: Añade funcionalidades dinámicamente a un objeto sin alterar su estructura.

#### Comportamiento
- **Strategy**: Define una familia de algoritmos intercambiables en tiempo de ejecución (ej. calculadores de impuestos según el país).
- **Observer / Pub-Sub**: Mecanismo de suscripción para notificar eventos a múltiples objetos.

#### Casos Específicos de Resiliencia
- **Rate Limiter**: Limita la frecuencia de peticiones HTTP por cliente (Token Bucket / Sliding Window).
- **Circuit Breaker**: Detiene peticiones a un servicio externo caído para evitar fallas en cascada (Estados: *Closed*, *Open*, *Half-Open*).
- **Retry con Backoff Exponencial + Jitter**: Reintenta operaciones fallidas aumentando el tiempo de espera exponencialmente con una variación aleatoria (*Jitter*) para evitar saturar el servidor recovery.

---

## 10. Patrones de Arquitectura

### 💡 Comparativa Resumida para Búsqueda Rápida

| Arquitectura | Enfoque Principal | Cuándo Utilizar |
| :--- | :--- | :--- |
| **Clean Architecture / Hexagonal** | Separa el dominio central de la infraestructura mediante Puertos (Interfaces) y Adaptadores (Implementaciones). | Sistemas empresariales de larga duración donde las bases de datos o frameworks pueden cambiar. |
| **CQRS** | Separa los modelos de lectura (optimizado para queries) de los de escritura (optimizado para comandos). | Sistemas con alta asimetría de tráfico (ej. 95% lecturas, 5% escrituras). |
| **Event Sourcing** | En lugar de guardar el estado actual, guarda la secuencia inmutable de todos los eventos que han ocurrido. | Sistemas financieros, bancarios o de auditoría donde el historial completo es obligatorio. |
| **Strangler Fig Pattern** | Migración gradual de un Monolito hacia Microservicios interceptando rutas en el Proxy/API Gateway. | Migración de sistemas legados pesados sin detener la operación del negocio. |

---

## 5. Conclusión Rápida para Entrevista

Usando esta guía técnica de búsqueda rápida (`Concepts.md`), contarás con las definiciones exactas, decisiones de diseño justificadas y patrones de arquitectura de nivel **Senior / Lead / Manager** necesarios para responder con solidez cualquier evaluación técnica.
