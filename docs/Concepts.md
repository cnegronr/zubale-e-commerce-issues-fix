# Manual de Conceptos Técnicos, Estándares de Arquitectura y Guía de Búsqueda Rápida para Entrevista con Manager (`Concepts.md`)

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

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
Node.js es un entorno de ejecución (*runtime*) asíncrono y orientado a eventos construido sobre el motor V8 de Google Chrome. TypeScript agrega un sistema de tipos estático sobre JavaScript.
- **Casos de Uso**: Microservicios I/O intensivos, APIs REST/GraphQL de alta concurrencia, aplicaciones en tiempo real (WebSockets), backend for frontend (BFF).
- **Estándar de Industria**: Node.js v20+ LTS, TypeScript 5+ con `strict: true`, empaquetado con `pnpm`, soporte ESM (*ECMAScript Modules*), y runtime seguro sin dependencias innecesarias.

### 🏛️ Estándar de Arquitectura y Estructura de Código
```
src/
├── domain/                  # Lógica pura de negocio (Entidades, Value Objects)
├── application/             # Casos de uso y orquestación
├── infrastructure/          # Conexiones a BD, HTTP Clients, File System
│   └── logging/             # Logger estructurado (Pino / Winston)
└── shared/                  # Utilidades comunes y tipos globales
```
- **Fronteras**: La capa de Dominio no debe depender de bibliotecas externas ni de la infraestructura Node.js.

### 💡 Conceptos Clave & Definiciones Concisas
- **Event Loop**: Bucle monohilo no bloqueante de Node.js que delega operaciones I/O a `libuv`.
- **Microtask vs Macrotask**:
  - *Microtask*: `Promise.then()`, `process.nextTick()`, `queueMicrotask()`. Tienen prioridad máxima y se ejecutan al terminar el ciclo actual.
  - *Macrotask*: `setTimeout()`, `setInterval()`, `setImmediate()`, eventos I/O.
- **Utility Types**: `Partial<T>`, `Required<T>`, `Readonly<T>`, `Record<K, T>`, `Pick<T, K>`, `Omit<T, K>`.
- **Discriminated Unions**: Patrón con propiedad común discriminante para permitir *Type Narrowing* automático.
- **Streams vs Buffers**:
  - *Buffer*: Carga todo el archivo en memoria RAM.
  - *Stream*: Procesa datos en trozos continuos (*chunks*). (`Readable`, `Writable`, `Transform`).

### ✅ Buenas Prácticas de Producción
- Habilitar `strict: true` en `tsconfig.json` y prohibir el uso de `any` (usar `unknown` + Type Guards).
- Usar `Stream.pipeline()` para evitar fugas de memoria en transferencia de archivos grandes.

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Cómo detectas y previenes Memory Leaks en Node.js?**
  - **A**: Diagnóstico con Heap Snapshots (`node --inspect`) y métricas de memoria `process.memoryUsage()`. Principales causas: Event Listeners sin des-registrar (`EventEmitter.on`), referencias globales retenidas y closures que retienen objetos pesados.
- **Q: ¿Cuándo usaría `unknown` sobre `any`?**
  - **A**: `unknown` es el equivalente seguro de `any`. Obliga a realizar validaciones de tipo (*Type Guards*) antes de operar sobre la variable.

---

## 2. NestJS

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
NestJS es un framework progresivo de Node.js construido con TypeScript que provee una arquitectura modular fuera de la caja basada en la Inyección de Dependencias, fuertemente inspirada en Angular.
- **Casos de Uso**: Microservicios empresariales, sistemas transaccionales escalables, APIs empresariales multi-inquilino (*Multitenant*).
- **Estándar de Industria**: NestJS v11+, Nest CLI, integración con TypeORM/Prisma, validación estricta con `class-validator`, documentación OpenAPI/Swagger automática y testing con Jest.

### 🏛️ Estándar de Arquitectura y Estructura de Código
```
src/
├── common/                  # Interceptores, Pipes, Guards, Filters globales
├── config/                  # Validación de variables de entorno (Joi/Zod)
├── database/                # Migraciones y configuración TypeORM
├── modules/                 # Módulos de dominio (Monolito Modular)
│   └── orders/
│       ├── controllers/     # Capa de Entrada HTTP (Presentación)
│       ├── services/        # Lógica de Aplicación
│       ├── dto/             # Objetos de Transferencia de Datos con validación
│       ├── entities/        # Entidades ORM / Dominio
│       └── orders.module.ts # Definición del Módulo NestJS
├── app.module.ts            # Módulo Raíz
└── main.ts                  # Punto de entrada (Configuración del Server)
```

### 💡 Conceptos Clave & Definiciones Concisas
- **Inyección de Dependencias (DI) & IoC**: El contenedor de NestJS gestiona la instanciación de clases anotadas con `@Injectable()`.
- **Scopes de Providers**:
  - `DEFAULT` (Singleton): 1 instancia global compartida (máximo rendimiento).
  - `REQUEST`: 1 instancia nueva por cada petición HTTP (para multitenancy).
  - `TRANSIENT`: 1 instancia nueva por cada punto de inyección.
- **Componentes del Pipeline HTTP**: `Middleware` $\rightarrow$ `Guards` $\rightarrow$ `Interceptors (Pre)` $\rightarrow$ `Pipes` $\rightarrow$ `Controller` $\rightarrow$ `Interceptors (Post)` $\rightarrow$ `Exception Filters`.

### ✅ Buenas Prácticas de Producción
- Configurar `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
- Estructurar como **Monolito Modular** con fronteras claras entre módulos para facilitar la migración a microservicios.

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Cómo evitas problemas de rendimiento si usas `REQUEST` Scope en NestJS?**
  - **A**: Aislando el scope únicamente a los servicios que consumen directamente los encabezados HTTP (ej. Tenant ID). El resto del árbol de dependencias debe mantenerse en `DEFAULT` (Singleton).

---

## 3. React & Next.js

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
React es una biblioteca de UI basada en componentes. Next.js es el framework de React de grado de producción que incluye renderizado híbrido en servidor/cliente, enrutamiento basado en archivos y optimización automática.
- **Casos de Uso**: Aplicaciones web progresivas (PWA), plataformas e-commerce de alto tráfico, portales SaaS, dashboards interactivos.
- **Estándar de Industria**: Next.js 14/15 App Router, React 18/19 Server Components (RSC), Tailwind CSS, TypeScript estricto, y estado global ligero (Zustand/TanStack Query).

### 🏛️ Estándar de Arquitectura y Estructura de Código (App Router)
```
src/
├── app/                     # Rutas, layouts y Server Actions (App Router)
│   ├── (auth)/              # Grupo de rutas de autenticación
│   ├── products/            # Ruta /products
│   │   ├── page.tsx         # Componente de Página (Server Component)
│   │   └── loading.tsx      # Skeleton UI de carga
│   ├── layout.tsx           # Layout Raíz
│   └── providers.tsx        # Providers de Cliente (Context API, React Query)
├── components/              # Componentes Reutilizables de UI
│   ├── ui/                  # Componentes atómicos (Botones, Modales)
│   └── modules/             # Componentes complejos de dominio
├── hooks/                   # Custom Hooks reutilizables
├── services/                # Clientes API / Fetchers
└── types/                   # Definiciones de TypeScript
```

### 💡 Conceptos Clave & Definiciones Concisas
- **Virtual DOM & Reconciliation (Fiber)**: Algoritmo de diferenciación (*diffing*) que compara el árbol VDOM en memoria con el DOM real para aplicar solo las mutaciones mínimas necesarias.
- **Renderizado Híbrido**:
  - *Server Components (RSC)*: Renderizados exclusivamente en servidor; 0 KB de bundle JS enviado al navegador.
  - *Client Components (`'use client'`)*: Hidratados en el cliente para gestionar estado y eventos.
  - *SSG / ISR / SSR*: Generación estática / Revalidación incremental por tiempo / Renderizado dinámico en cada request.

### ✅ Buenas Prácticas de Producción
- Empujar el estado interactivo (`'use client'`) a los nodos hoja del árbol de componentes.
- Optimizar Core Web Vitals (LCP, INP, CLS) utilizando `next/image` y `next/font`.

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Cuándo elegir ISR sobre SSR en Next.js?**
  - **A**: Usar ISR para datos que cambian periódicamente pero son comunes para todos los usuarios (catálogos de e-commerce). Reduce la carga del servidor a cero sirviendo HTML estático precheados con revalidación en segundo plano (`revalidate: 60`).

---

## 4. Python & FastAPI

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
FastAPI es un framework web asíncrono y de alto rendimiento para Python basado en esquemas Pydantic y tipado estándar de Python 3.8+.
- **Casos de Uso**: Microservicios de Inferencia de Inteligencia Artificial / ML, APIs REST ultra rápidas, procesadores de datos asíncronos.
- **Estándar de Industria**: Python 3.11+, FastAPI, Pydantic v2, Uvicorn (ASGI Server), SQLAlchemy 2.0 (Async), Ruff (Linter/Formatter), y Poetry/uv para gestión de dependencias.

### 🏛️ Estándar de Arquitectura y Estructura de Código
```
app/
├── api/                     # Endpoints / Routers HTTP
│   └── v1/
│       └── endpoints/       # Controladores de rutas
├── core/                    # Configuración, seguridad (JWT) y DB Engine
├── db/                      # Modelos SQLAlchemy y migraciones Alembic
├── schemas/                 # Modelos Pydantic (Validación DTO)
├── services/                # Lógica de Negocio / Casos de Uso
└── main.py                  # Aplicación FastAPI y Middlewares
```

### 💡 Conceptos Clave & Definiciones Concisas
- **GIL (Global Interpreter Lock)**: Mutex en CPython que permite solo a un hilo ejecutar bytecode a la vez.
  - *I/O-Bound*: Usar `asyncio` o corrutinas.
  - *CPU-Bound*: Usar `multiprocessing` o módulos nativos en C/Rust.
- **WSGI vs ASGI**: WSGI es síncrono (Django/Flask tradicional); ASGI soporta `async/await` no bloqueante y WebSockets (FastAPI).
- **Dependency Injection en FastAPI**: Sistema nativo mediante `Depends()` para inyectar sesiones de DB o componentes de seguridad.

### ✅ Buenas Prácticas de Producción
- Usar drivers asíncronos (`asyncpg` para PostgreSQL) y evitar funciones bloqueantes síncronas dentro de funciones `async def`.

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Por qué FastAPI es significativamente más rápido que Flask o Django?**
  - **A**: Funciona sobre el motor ASGI Uvicorn con `asyncio`, utiliza Pydantic v2 con núcleo de validación compilado en Rust y procesa peticiones de I/O de forma no bloqueante.

---

## 5. Docker & Kubernetes (K8s)

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
Docker permite empaquetar aplicaciones en contenedores portátiles e inmutables. Kubernetes es la plataforma orquestadora estándar de la industria para automatizar el despliegue, escalado y gestión de contenedores.
- **Casos de Uso**: Despliegue de arquitecturas de microservicios en la nube (AWS EKS, GCP GKE, Azure AKS).
- **Estándar de Industria**: Imágenes base Alpine/Distroless, manifiestos declarativos de K8s, Helm Charts, GitOps con ArgoCD/Flux.

### 🏛️ Estándar de Arquitectura de Manifiestos K8s
```
k8s/
├── base/                    # Manifiestos base
│   ├── deployment.yaml      # Especificación de Pods y Réplicas
│   ├── service.yaml         # Enrutamiento interno (ClusterIP)
│   ├── hpa.yaml             # Autosescalado horizontal
│   └── configmap.yaml       # Variables de entorno no sensibles
└── overlays/                # Variaciones por entorno (dev, staging, prod)
    ├── dev/
    └── prod/
```

### 💡 Conceptos Clave & Definiciones Concisas
- **Contenedores vs VMs**: Los contenedores comparten el kernel del sistema operativo anfitrión; las VMs virtualizan todo el hardware.
- **Kubernetes Primitives**:
  - *Pod*: Unidad mínima de ejecución.
  - *Deployment*: Mantiene el estado deseado de réplicas de Pods y gestiona *rolling updates*.
  - *Service*: Balanceador interno e IP estable.
  - *Ingress*: Enrutador HTTP perimetral.
  - *Probes*: `livenessProbe` (reinicia Pod colgado) y `readinessProbe` (remueve Pod del balanceador si no está listo).

### ✅ Buenas Prácticas de Producción
- Ejecutar procesos dentro del contenedor con usuarios no privilegidados (`USER node`).
- Definir siempre `resources.requests` y `resources.limits` para evitar acaparamiento de memoria/CPU (*OOMKilled*).

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Qué ocurre si falla la Readiness Probe vs Liveness Probe?**
  - **A**: Si falla `readinessProbe`, K8s detiene el tráfico enviando las peticiones a otros Pods sin reiniciar el contenedor. Si falla `livenessProbe`, K8s destruye y vuelve a crear el contenedor.

---

## 6. DDD (Domain-Driven Design)

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
DDD es una filosofía de diseño de software orientada a estructurar sistemas complejos modelando la realidad del negocio en estrecha colaboración con los expertos de dominio.
- **Casos de Uso**: Core business de alta complejidad (Fintech, Logística, E-commerce transaccional).
- **Estándar de Industria**: Arquitectura Hexagonal / Clean Architecture, separación en Bounded Contexts y Event Sourcing en dominios auditables.

### 🏛️ Estándar de Arquitectura DDD (Bounded Context)
```
order-context/
├── domain/                  # Lógica pura de negocio (Entidades, Value Objects, Domain Events)
├── application/             # Casos de uso, Handlers de Comandos y Eventos
├── infrastructure/          # Persistencia (ORM Repositories), API Adapters, Message Brokers
└── presentation/            # Controllers HTTP, Subscriptores de Eventos
```

### 💡 Conceptos Clave & Definiciones Concisas
- **Ubiquitous Language**: Lenguaje común unificado entre desarrolladores y expertos del negocio.
- **Bounded Context**: Límite explícito dentro del cual un modelo de dominio tiene un significado único.
- **Building Blocks**:
  - *Entity*: Objeto con identidad única que evoluciona en el tiempo (`Order`).
  - *Value Object*: Objeto inmutable definido por sus atributos sin identidad propia (`Money`).
  - *Aggregate Root*: Entidad principal que garantiza la consistencia de las reglas de negocio de todo su grupo.

### ✅ Buenas Prácticas de Producción
- Proteger la capa de Dominio para que no importe librerías de infraestructura (ORM, Express, NestJS).

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Diferencia entre Anemic Domain Model y Rich Domain Model?**
  - **A**: En el Anémico las entidades son solo estructuras de datos (`getters/setters`) y la lógica está en los servicios. En el Rico, las entidades contienen las reglas de negocio y validaciones de datos dentro de sí mismas.

---

## 7. EDD (Event-Driven Development)

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
EDD es una arquitectura de software donde los sistemas reaccionan a la producción y consumo de eventos de estado inmutables.
- **Casos de Uso**: Procesamiento asíncrono en tiempo real, arquitecturas de microservicios desacoplados, analítica de datos.
- **Estándar de Industria**: Apache Kafka, RabbitMQ, Event Stacking con AWS EventBridge, y gobernanza de esquemas con Avro/Protobuf.

### 🏛️ Estándar de Arquitectura EDD (Transactional Outbox)
```
servicio-ordenes/
├── domain/
├── infrastructure/
│   ├── database/
│   │   ├── order.table.sql
│   │   └── outbox.table.sql # Guarda eventos en la misma transacción SQL
│   └── messaging/
│       └── outbox-relay.worker.ts # Lee Outbox y publica en RabbitMQ/Kafka
```

### 💡 Conceptos Clave & Definiciones Concisas
- **Transactional Outbox Pattern**: Garantiza que un evento no se pierda guardándolo en la base de datos SQL en la misma transacción que la entidad antes de enviarlo al broker.
- **CQRS**: Separa la responsabilidad de actualización (Commands) de la de lectura (Queries).
- **Diferencia RabbitMQ vs Kafka**:
  - *RabbitMQ*: Broker de colas tradicional; ideal para tareas complejas y enrutamiento granular.
  - *Kafka*: Plataforma de event streaming basada en logs de transacciones; ideal para millones de eventos/seg y retención de historial.

### ✅ Buenas Prácticas de Producción
- Diseñar todos los consumidores de eventos para que sean **Idempotentes**.

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Cómo evitas la pérdida de eventos si el Message Broker está caído?**
  - **A**: Utilizando el *Transactional Outbox Pattern*. El evento queda guardado en la tabla `outbox` de la DB local y un worker reintenta el envío cuando el broker recupera la conectividad.

---

## 8. DevOps, Git & GitHub Actions

### 🌐 Reseña Global, Casos de Uso y Estándares de Industria
DevOps integra el desarrollo (*Dev*) y las operaciones (*Ops*) para automatizar el ciclo de vida de entrega de software con integración y despliegue continuos (CI/CD).
- **Casos de Uso**: Automatización de pruebas, construcción de artefactos inmutables y despliegues sin interrupción de servicio (*Zero-Downtime Deployments*).
- **Estándar de Industria**: GitHub Actions, Trunk-Based Development con Feature Flags, Semantic Versioning (SemVer), escaneo de vulnerabilidades (Snyk/Trivy).

### 🏛️ Estándar de Estructura de Pipelines CI/CD (`.github/workflows/`)
```
.github/
└── workflows/
    ├── ci.yml               # Pipeline de Pruebas, Lint y Build en PRs
    └── cd.yml               # Pipeline de Despliegue a Producción en Main
```

### 💡 Conceptos Clave & Definiciones Concisas
- **Trunk-Based Development**: Todos los desarrolladores envían pequeños cambios frecuentemente a la rama principal (`main`), usando **Feature Flags** para activar/desactivar características en producción.
- **GitFlow**: Modelo tradicional con ramas persistentes de larga duración (`develop`, `main`, `release/*`).
- **GitHub Actions Components**: `Workflow` $\rightarrow$ `Job` $\rightarrow$ `Step` $\rightarrow$ `Runner`.

### ✅ Buenas Prácticas de Producción
- Usar cachés de dependencias (`actions/cache`) y construir imágenes Docker inmutables etiquetadas con el SHA del commit de Git.

### 🎙️ Q&A Típica de Entrevista con el Manager
- **Q: ¿Por qué Trunk-Based Development es preferido en CI/CD continuo sobre GitFlow?**
  - **A**: Evita los "Merge Hells" al integrar código diariamente, permite iteraciones rápidas y reduce drásticamente el tiempo de salida a mercado (*Time to Market*).

---

## 9. Patrones de Diseño (GoF) y Casos Específicos

### 🌐 Reseña Global y Estándares de Industria
Los patrones de diseño son soluciones reutilizables probadas para problemas comunes de diseño de software.

### 💡 Catálogo Rápido de Patrones de Búsqueda Rápida

#### 1. Creacionales
- **Factory Method**: Crea objetos sin especificar la clase exacta exacta a instanciar.
- **Builder**: Construye objetos complejos paso a paso.
- **Singleton**: Asegura que una clase tenga una sola instancia global.

#### 2. Estructurales
- **Adapter**: Permite a clases con interfaces incompatibles trabajar juntas (ej. envoltorio para pasarelas de pago).
- **Decorator**: Añade responsabilidades a un objeto dinámicamente.
- **Facade**: Proporciona una interfaz simplificada para un subsistema complejo.

#### 3. Comportamiento
- **Strategy**: Permite intercambiar algoritmos en tiempo de ejecución (ej. estrategias de cálculo de envíos).
- **Observer**: Mecanismo de suscripción para notificar cambios a múltiples objetos.
- **Command**: Encapsula una petición como un objeto.

#### 4. Resiliencia y Casos Específicos
- **Rate Limiter**: Limita la frecuencia de peticiones HTTP (Token Bucket / Sliding Window).
- **Circuit Breaker**: Detiene peticiones a un servicio caído para evitar fallas en cascada (*Closed, Open, Half-Open*).
- **Retry con Exponential Backoff + Jitter**: Reintenta operaciones aumentando el tiempo de espera con variación aleatoria.

---

## 10. Patrones de Arquitectura

### 🌐 Reseña Global y Estándares de Industria
Los patrones de arquitectura definen la estructura general y organización de componentes de alto nivel en un sistema de software.

### 💡 Comparativa Resumida para Búsqueda Rápida

| Arquitectura | Enfoque Principal | Cuándo Utilizar |
| :--- | :--- | :--- |
| **Clean Architecture / Hexagonal** | Aísla el dominio central de la infraestructura mediante Puertos y Adaptadores. | Sistemas empresariales de larga duración con múltiples integraciones externas. |
| **CQRS** | Separa el modelo de lectura del de escritura. | Sistemas con alta asimetría de tráfico (ej. 95% lecturas, 5% escrituras). |
| **Event Sourcing** | Guarda la secuencia inmutable de eventos que han cambiado el estado en lugar del estado actual. | Sistemas financieros, bancarios y de auditoría estricta. |
| **Strangler Fig Pattern** | Reemplaza gradualmente partes de un sistema legado por microservicios interceptando rutas en la entrada. | Migración progresiva de Monolitos pesados a microservicios sin detener el negocio. |

---

## 5. Conclusión Rápida para Entrevista

Esta guía estructurada (`Concepts.md`) ofrece la visión completa de **marcos de trabajo, arquitectura de carpetas, conceptos de ingeniería y patrones de diseño** necesarios para liderar y fundamentar decisiones técnicas de nivel **Senior / Lead / Manager**.
