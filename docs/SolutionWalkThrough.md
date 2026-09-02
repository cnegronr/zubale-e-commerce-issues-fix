# Walkthrough de Solución Técnica e Informe de Ingeniería (`SolutionWalkThrough.md`)

**Destinatario**: Dirección de Ingeniería / Technical Management  
**Proyecto**: E-Commerce Microservice Refactoring & Resiliency Challenge (`NestJS`, `PostgreSQL`, `Redis`, `TypeORM`, `Jest`)  
**Estado Actual**: 100% de Pruebas Pasadas | 100% Cobertura de Código en las 4 Métricas (`Statements`, `Branches`, `Functions`, `Lines`)  

---

## 1. Metodología de Desarrollo Agéntico y Flujo de Trabajo (Agentic Engineering Workflow)

El proceso de refactorización, depuración y optimización de la aplicación se llevó a cabo aplicando un enfoque de **Desarrollo Agéntico Guiado (Agentic Pair-Programming)**, combinando la velocidad de generación de código mediante Inteligencia Artificial autónoma con la supervisión, auditoría de arquitectura y validación estricta de un desarrollador senior.

```
                  ┌──────────────────────────────────────────────────┐
                  │                 INSTRUCTIONS.md                  │
                  │        (Especificación Inicial de Fallos)        │
                  └─────────────────────────┬────────────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │                     AGENT.md                     │
                  │     (Contrato de Arquitectura y Reglas 100%)     │
                  └─────────────────────────┬────────────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │          Fase 1: Reproducción Empírica           │
                  │   (Pruebas de Integración/E2E de Fallas Iniciales)  │
                  └─────────────────────────┬────────────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │         Fase 2: Generación Acelerada e           │
                  │          Interacción Desarrollador-Agente        │
                  └─────────────────────────┬────────────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │     Fase 3: Pruebas Exploratorias Manuales       │
                  │             (Postman Collections 1-5)            │
                  └─────────────────────────┬────────────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │       Fase 4: Cobertura Automatizada 100%        │
                  │     (9 Unit + 6 Integration + 4 E2E Suites)      │
                  └──────────────────────────────────────────────────┘
```

### 1.1 Enfoque Agentic Development mediante Specs y `AGENT.md`
Al iniciar el reto, se definió el archivo **[AGENT.md](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/AGENT.md)** como la **fuente de verdad única e inalterable** del proyecto. `AGENT.md` estableció las reglas del sistema:
- Cobertura obligatoria del 100% en todas las métricas de Jest.
- Principio **Fail-Fast** en validaciones de identificadores (rechazo de IDs $\le 0$ antes de consultar la base de datos).
- Cero tolerancias a fallos silenciosos, promesas flotantes sin `await` o excepciones crudas de controladores de base de datos.
- Respeto absoluto a la arquitectura de dominio NestJS existente sin agregar dependencias innecesarias.

### 1.2 Análisis Asistido con `INSTRUCTIONS.md` como Insumo de Entrada
En lugar de modificar el código de producción de inmediato, se procesó **`INSTRUCTIONS.md`** como insumo inicial para construir **suites de pruebas automatizadas que reprodujeron empíricamente el 100% de los fallos reportados**. Ninguna línea de código de producción se alteró hasta no contar con una prueba fallida que demostrara la falla en los logs.

### 1.3 Aplicación de Mejoras Mediante Generación de Código y Desarrollo Acelerado
La IA actuó como un motor de desarrollo de alta velocidad para la creación de:
- DTOs de validación con decoradores `@Min(1)`.
- Pipes personalizados de NestJS (`ParsePositiveIntPipe`).
- Generación automatizada de mocks y stubs para las suites de prueba en Jest.

### 1.4 Exhaustiva Revisión de las Soluciones por parte del Desarrollador
Cada bloque de código generado por el agente fue **auditado minuciosamente por el desarrollador** antes de ser integrado. Se verificaron límites de memoria en Node.js, tiempo de retención en Redis, planes de ejecución de consultas en PostgreSQL y fronteras de inyección de dependencias en NestJS.

### 1.5 Interacción Agente-Desarrollador para Buenas Prácticas y Soluciones Óptimas
A través de un diálogo iterativo entre el desarrollador y el agente, se descartaron parches superficiales en favor de soluciones de dominio óptimas:
- **Respuesta Circular**: Se reemplazó el truco costoso de `JSON.parse(JSON.stringify)` por la construcción limpia de un objeto no circular utilizando el operador de propagación (`...order.user`) con un resumen estructurado de `latestOrder`.
- **Búsqueda de Productos**: Se sustituyó el filtrado manual en memoria JavaScript por consultas nativas SQL `ILike` en PostgreSQL con llaves de caché dinámicas en Redis (`product-search:query`).
- **Operaciones en Lote**: Se eliminaron los bucles con consultas `save()` individuales en favor de operaciones masivas array `save(productsToSave)`.

### 1.6 Pruebas Manuales del Desarrollador para Detección de Nuevos Issues
El desarrollador diseñó y ejecutó **5 Colecciones Numéricas de Postman** (`postman_collection_1.json` a `postman_collection_5.json`), realizando pruebas exploratorias de frontera que permitieron identificar fallos no documentados originalmente, tales como:
- Transiciones ilegales de estado en órdenes (`shipped` $\rightarrow$ `pending`).
- Idempotencia en endpoints de actualización de estado (`PATCH /orders/:id/status`).
- Aislamiento de llaves de caché ante variaciones de parámetros `q`.

### 1.7 Coverage Estricto del 100% por Cada Modificación Aplicada
Se configuró Jest con umbrales globales estrictos del 100% (`branches: 100`, `functions: 100`, `lines: 100`, `statements: 100`). Cualquier cambio o refactorización que redujera un solo porcentaje el coverage bloqueaba la ejecución del pipeline.

---

### 1.8 Desglose de Capas de Pruebas (Test Architecture Breakdown)

La suite de pruebas automatizada se estructuró en **3 capas bien definidas**:

```
+-----------------------------------------------------------------------------------+
|                            CAPAS DE PRUEBAS AUTOMATIZADAS                         |
+-----------------------------------------------------------------------------------+
|  1. PRUEBAS UNITARIAS (`test/unit/`) - 9 Suites | 102 Tests | 100% Coverage      |
|     - Pruebas aisladas en memoria para Controllers, Services, Pipes y DTOs.     |
|     - Mocks completos de Repositorios TypeORM y CacheManager de Redis.            |
+-----------------------------------------------------------------------------------+
|  2. PRUEBAS DE INTEGRACIÓN (`test/integration/`) - 6 Suites | 42 Tests | 100% Coverage |
|     - Pruebas de contrato de base de datos, restricciones de clave única (23505).  |
|     - Aislamiento de llaves de caché Redis y locks de concurrencia en inventario. |
+-----------------------------------------------------------------------------------+
|  3. PRUEBAS END-TO-END (`test/e2e/`) - 4 Suites | 52 Tests | 100% Coverage         |
|     - Flujo HTTP completo de extremo a extremo usando Supertest en NestJS.        |
|     - Ejecución real sobre base de datos PostgreSQL y motor de Redis.             |
+-----------------------------------------------------------------------------------+
```

---

## 2. Análisis Detallado de Issues, Diagnóstico Técnico y Comparativa de Código (Before / After)

A continuación se detalla cada uno de los **8 issues técnicos** detectados y resueltos en la aplicación, incluyendo su diagnóstico, el código original que causaba la falla y la solución implementada.

---

### 🔴 Issue 1: Referencia Circular y Crash de Serialización JSON en `getOrderWithFullDetails`

- **Diagnóstico Técnico**: El endpoint `GET /orders/:id/full` intentaba adjuntar la última orden del usuario dentro de la relación `user`. Sin embargo, asignaba el objeto completo de la orden dentro de `user.latestOrder`, creando una referencia circular infinita (`Order` $\rightarrow$ `User` $\rightarrow$ `Order` $\rightarrow$ `User`). Al intentar serializar la respuesta a JSON, Node.js lanzaba `TypeError: Converting circular structure to JSON` o silenciaba los datos del usuario.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/orders/orders.service.ts (Original)
async getOrderWithFullDetails(id: number): Promise<any> {
  const order = await this.ordersRepository.findOne({
    where: { id },
    relations: ['user', 'items', 'items.product'],
  });
  
  if (!order) {
    throw new NotFoundException(`Order #${id} not found`);
  }

  // ¡ERROR! Convierte a JSON y crea referencia circular directa
  const enriched: any = JSON.parse(JSON.stringify(order));
  if (order.user) {
    enriched.user.latestOrder = enriched; // Recursión infinita
  }

  return enriched;
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/orders/orders.service.ts (Actual)
async getOrderWithFullDetails(id: number): Promise<any> {
  if (!id || id <= 0) {
    throw new BadRequestException(`ID parameter "${id}" must be a positive integer greater than 0`);
  }

  const order = await this.ordersRepository.findOne({
    where: { id },
    relations: ['user', 'items', 'items.product', 'items.product.category'],
  });
  
  if (!order) {
    throw new NotFoundException(`Order #${id} not found`);
  }

  // Solución limpia con spread operator y resumen no circular
  const enriched: any = { ...order };
  if (order.user) {
    enriched.user = {
      ...order.user,
      latestOrder: {
        id: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
      },
    };
  }

  return enriched;
}
```

---

### 🔴 Issue 2: Condición de Carrera en Pago, Bloqueo de Sockets HTTP y Descuento Asíncrono de Stock

- **Diagnóstico Técnico**:
  1. En `OrdersService.create`, el descuento de inventario `updateStock` se invocaba como una promesa flotante sin el operador `await`. Bajo peticiones concurrentes, múltiples solicitudes leían el mismo stock de PostgreSQL antes de que la actualización terminara, causando sobregiros de inventario negativos.
  2. En `OrdersService.processPayment`, los reintentos de pago se ejecutaban en un bucle `while` de hasta 1000 iteraciones con esperas de 100ms sin límite de tiempo, bloqueando los sockets HTTP hasta por 100 segundos y saturando el servidor.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/orders/orders.service.ts (Original)
// 1. Promesa flotante sin await que corrompe el inventario
for (const item of createOrderDto.items) {
  const product = await this.productsService.findOne(item.productId);
  this.productsService.updateStock(product.id, product.stock - item.quantity); // ¡Sin await!
}

// 2. Bucle desmedido que bloquea los sockets HTTP
let attempts = 0;
while (attempts < 1000) {
  try {
    return await paymentService.processPayment(orderId, amount);
  } catch (error) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 100)); // Bloquea hasta 100s
  }
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/orders/orders.service.ts (Actual)
// 1. Espera síncrona obligatoria del descuento de stock
for (const item of createOrderDto.items) {
  const product = await this.productsService.findOne(item.productId);
  if (product.stock < item.quantity) {
    throw new BadRequestException(`Insufficient stock for product #${item.productId}`);
  }
  await this.productsService.updateStock(product.id, product.stock - item.quantity); // Con await
}

// 2. Límite de reintentos acotado (5) con respuesta limpia HTTP 503
async processPayment(orderId: number): Promise<{ success: boolean; transactionId: string }> {
  const order = await this.findOne(orderId);
  if (order.status === OrderStatus.CANCELLED) {
    throw new BadRequestException('Cannot process payment for cancelled order');
  }

  let attempts = 0;
  while (attempts < this.maxRetries) { // maxRetries = 5
    try {
      const result = await paymentService.processPayment(order.id, order.total);
      order.status = OrderStatus.CONFIRMED;
      await this.ordersRepository.save(order);
      return result;
    } catch (error) {
      attempts++;
    }
  }

  throw new ServiceUnavailableException('Payment service temporarily unavailable after maximum retries');
}
```

---

### 🔴 Issue 3: Contaminación de Caché en Búsquedas de Productos

- **Diagnóstico Técnico**: El método `ProductsService.searchProducts` almacenaba y recuperaba los resultados de búsqueda en Redis utilizando una llave estática fija `'products-search'`. Como resultado, la primera consulta (ej. `?q=laptop`) guardaba sus resultados en la llave estática, y las búsquedas posteriores con otros parámetros (ej. `?q=phone`) retornaban erróneamente los resultados cacheados de la búsqueda anterior.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/products/products.service.ts (Original)
async searchProducts(query: string): Promise<Product[]> {
  // ¡Llave estática única para todas las búsquedas!
  const cached = await this.cacheManager.get<Product[]>('products-search');
  if (cached) {
    return cached;
  }

  const products = await this.findAll();
  const results = products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  await this.cacheManager.set('products-search', results, 60000);
  return results;
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/products/products.service.ts (Actual)
async searchProducts(query: string): Promise<Product[]> {
  const searchQuery = (query || '').trim();
  // Llave dinámica aislada por parámetro de búsqueda
  const cacheKey = `product-search:${searchQuery.toLowerCase()}`;
  
  const cached = await this.cacheManager.get<Product[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Filtrado SQL ILike nativo en PostgreSQL
  const results = await this.productsRepository.find({
    where: [
      { name: ILike(`%${searchQuery}%`) },
      { description: ILike(`%${searchQuery}%`) },
    ],
    relations: ['category'],
  });

  await this.cacheManager.set(cacheKey, results, 60000);
  return results;
}
```

---

### 🔴 Issue 4: Silenciamiento de Errores en Procesamiento por Lotes (`processProductBatch`)

- **Diagnóstico Técnico**: Durante el procesamiento masivo de productos en `processProductBatch`, si un ID no existía o la base de datos arrojaba un error, la excepción se capturaba en un bloque `catch` silencioso que imprimía a la consola (`console.log`) y retornaba `{ success: true, processed: 0 }`. El cliente HTTP recibía un status `200 OK` indicando éxito sin saber cuáles productos habían fallado.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/products/products.service.ts (Original)
async processProductBatch(productIds: number[]): Promise<{ success: boolean; processed: number }> {
  let processed = 0;
  for (const id of productIds) {
    try {
      const product = await this.findOne(id);
      product.updatedAt = new Date();
      await this.productsRepository.save(product);
      processed++;
    } catch (error) {
      console.log('Error processing product:', error); // ¡Silencia el error!
    }
  }
  return { success: true, processed };
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/products/products.service.ts (Actual)
async processProductBatch(productIds: number[]): Promise<{ success: boolean; processed: number; failedProductIds?: number[] }> {
  let processed = 0;
  const failedProductIds: number[] = [];
  const productsToSave: Product[] = [];

  try {
    for (const id of productIds) {
      if (!id || id <= 0) {
        failedProductIds.push(id);
        continue;
      }
      try {
        const product = await this.findOne(id);
        product.updatedAt = new Date();
        productsToSave.push(product);
        processed++;
      } catch (error) {
        failedProductIds.push(id);
      }
    }

    if (productsToSave.length > 0) {
      await this.productsRepository.save(productsToSave); // Guardado masivo optimizado
    }
  } catch (error) {
    throw new BadRequestException('Batch processing failed');
  }

  return {
    success: true,
    processed,
    failedProductIds: failedProductIds.length > 0 ? failedProductIds : undefined,
  };
}
```

---

### 🔴 Issue 5: Excepción Cruda 500 en Registro de Email Duplicado

- **Diagnóstico Técnico**: Al intentar registrar un usuario con un correo electrónico existente, el método `UsersService.create` no capturaba la excepción de restricción de clave única de PostgreSQL (`UQ_user_email` / código `23505`). La excepción no controlada se filtraba a través del framework respondiendo un error genérico **HTTP 500 Internal Server Error** en lugar de una excepción de dominio **HTTP 409 Conflict**.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/users/users.service.ts (Original)
async create(createUserDto: CreateUserDto): Promise<User> {
  const user = this.usersRepository.create(createUserDto);
  return this.usersRepository.save(user); // ¡Filtra QueryFailedError 500!
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/users/users.service.ts (Actual)
async create(createUserDto: CreateUserDto): Promise<User> {
  try {
    const user = this.usersRepository.create(createUserDto);
    return await this.usersRepository.save(user);
  } catch (error) {
    if (error && (error.code === '23505' || error.number === 23505)) {
      throw new ConflictException(`User with email "${createUserDto.email}" already exists`);
    }
    throw error;
  }
}
```

---

### 🔴 Issue 6: Validación de Categoría Padre Inexistente y Crash en Árbol de Categorías

- **Diagnóstico Técnico**:
  1. `ProductsService.createCategory` permitía enviar un `parentId` que no existía en la base de datos (ej. `99999` o `0`), creando categorías huérfanas con llaves foráneas inválidas.
  2. Al consultar la jerarquía de categorías en `getCategoryTree`, el sistema asumía que la relación `parent` siempre estaba poblada, provocando caídas por `TypeError: Cannot read properties of null` cuando la categoría carecía de padre.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/products/products.service.ts (Original)
// 1. Creación sin validación previa de existencia del padre
async createCategory(dto: CreateCategoryDto): Promise<Category> {
  const category = this.categoriesRepository.create(dto);
  return this.categoriesRepository.save(category);
}

// 2. Construcción del árbol sin verificación de nulos
private buildCategoryTree(category: Category): any {
  return {
    id: category.id,
    name: category.name,
    parent: { id: category.parent.id, name: category.parent.name }, // ¡TypeError si parent es null!
  };
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/products/products.service.ts (Actual)
// 1. Validación previa obligatoria de la categoría padre
async createCategory(dto: CreateCategoryDto): Promise<Category> {
  if (dto.parentId !== undefined && dto.parentId !== null) {
    if (dto.parentId <= 0) {
      throw new BadRequestException(`Cannot create category because parent category #${dto.parentId} does not exist`);
    }
    try {
      await this.findCategory(dto.parentId);
    } catch (err) {
      throw new BadRequestException(`Cannot create category because parent category #${dto.parentId} does not exist`);
    }
  }
  const category = this.categoriesRepository.create(dto);
  return this.categoriesRepository.save(category);
}

// 2. Construcción segura del árbol jerárquico
private buildCategoryTree(category: Category): any {
  const tree: any = {
    id: category.id,
    name: category.name,
    children: [],
  };

  if (category.parentId && category.parent) {
    tree.parent = this.buildCategoryTree(category.parent);
  }

  if (category.children && category.children.length > 0) {
    tree.children = category.children.map(child => this.buildCategoryTree(child));
  }

  return tree;
}
```

---

### 🔴 Issue 7: Validaciones Fail-Fast de Identificadores Cero y Negativos (`ParsePositiveIntPipe` & `@Min(1)`)

- **Diagnóstico Técnico**: La aplicación utilizaba el pipe estándar `ParseIntPipe` en las rutas HTTP. Este pipe convertía cadenas a enteros pero permitía valores iguales a `0` o números negativos (ej. `/users/0`, `/orders/-5`). Esas peticiones ingresaban a la capa de servicios, ejecutando consultas innecesarias en PostgreSQL o retornando respuestas incoherentes.

#### ❌ Código Original (Causa Raíz):
```typescript
// src/users/users.controller.ts (Original)
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) { // Acepta 0, -1, -99
  return this.usersService.findOne(id);
}
```

#### ✅ Código Actual Corregido:
```typescript
// src/common/pipes/parse-positive-int.pipe.ts (Nuevo Pipe Personalizado)
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);
    if (isNaN(val) || val <= 0) {
      throw new BadRequestException(`ID parameter "${value}" must be a positive integer greater than 0`);
    }
    return val;
  }
}

// src/users/users.controller.ts (Actual)
@Get(':id')
findOne(@Param('id', ParsePositiveIntPipe) id: number) { // Rechaza <= 0 en la frontera HTTP con 400 Bad Request
  return this.usersService.findOne(id);
}
```

---

### 🔴 Issue 8: Optimizaciones de Rendimiento y Base de Datos (SQL `ILike`, Bulk Save e Índices DB)

- **Diagnóstico Técnico**:
  1. `searchProducts` leía todas las filas de la tabla `products` cargándolas enteras en la memoria de Node.js para filtrarlas mediante `.filter()`, generando cuellos de botella de CPU y memoria a medida que el catálogo crecía.
  2. `processProductBatch` ejecutaba una instrucción SQL `UPDATE` individual en un bucle `for` por cada producto.
  3. Las entidades TypeORM no definían índices en la base de datos en las columnas de mayor frecuencia de búsqueda y filtrado (`name`, `category_id`, `user_id`, `status`).

#### ❌ Código Original (Causa Raíz):
```typescript
// src/products/products.service.ts (Original)
// Carga todo el catálogo a memoria y filtra con JS
const products = await this.productsRepository.find({ relations: ['category'] });
return products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
```

#### ✅ Código Actual Corregido:
```typescript
// 1. Filtrado SQL ILike nativo en PostgreSQL (src/products/products.service.ts)
const products = await this.productsRepository.find({
  where: [
    { name: ILike(`%${searchQuery}%`) },
    { description: ILike(`%${searchQuery}%`) },
  ],
  relations: ['category'],
});

// 2. Operación Bulk Save en una sola consulta SQL
if (productsToSave.length > 0) {
  await this.productsRepository.save(productsToSave);
}

// 3. Decoradores @Index en Entidades TypeORM (src/products/product.entity.ts)
@Entity('products')
@Index(['name'])
@Index(['categoryId'])
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number;
}
```

---

## 3. Resumen de Verificación y Cobertura Automatizada

El estado actual del proyecto cuenta con **100% de pasabilidad en 19 suites de prueba** y **100% de cobertura de código en todas las métricas exigidas**:

```bash
-----------------------------|---------|----------|---------|---------|-------------------
File                         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------------------|---------|----------|---------|---------|-------------------
All files                    |     100 |      100 |     100 |     100 |                   
 src                         |     100 |      100 |     100 |     100 |                   
  app.controller.ts          |     100 |      100 |     100 |     100 |                   
  app.service.ts             |     100 |      100 |     100 |     100 |                   
 src/common/pipes            |     100 |      100 |     100 |     100 |                   
  parse-positive-int.pipe.ts |     100 |      100 |     100 |     100 |                   
 src/orders                  |     100 |      100 |     100 |     100 |                   
  orders.controller.ts       |     100 |      100 |     100 |     100 |                   
  orders.service.ts          |     100 |      100 |     100 |     100 |                   
 src/products                |     100 |      100 |     100 |     100 |                   
  products.controller.ts     |     100 |      100 |     100 |     100 |                   
  products.service.ts        |     100 |      100 |     100 |     100 |                   
 src/users                   |     100 |      100 |     100 |     100 |                   
  users.controller.ts        |     100 |      100 |     100 |     100 |                   
  users.service.ts           |     100 |      100 |     100 |     100 |                   
-----------------------------|---------|----------|---------|---------|-------------------
Test Suites: 19 passed, 19 total
Tests:       196 passed, 196 total
```

---

## 4. Conclusión

Gracias al enfoque de **Desarrollo Agéntico estructurado**, la aplicación ha evolucionado desde un estado inicial frágil y con fallas intermitentes hacia un microservicio **robusto, resiliente, de alto rendimiento y 100% probado en todas sus capas**.
