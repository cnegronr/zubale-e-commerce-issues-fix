# Action Plan - Root Cause Resolution & Verification (`INSTRUCTIONS.md`)

This action plan addresses all requirements in `INSTRUCTIONS.md`, focusing first on **Getting Started** (reproducing reported symptoms empirically via automated integration/E2E test suites and log extraction) before executing targeted, root-cause code fixes across all microservice components.

---

## Stage 1: Getting Started - Reproduction & Empirical Evidence

We have empirically reproduced all reported symptoms listed in `INSTRUCTIONS.md` and subsequent issue reports (`Issues.md`, `Issues2.md`, `Issues3.md`, `Issues4.md`) via dedicated test suites in `test/unit/`, `test/integration/`, and `test/e2e/`.

### 1. Symptom / Fallo 11: "Some requests are extremely slow or never complete" (Bloqueo Indefinido de Sockets HTTP)
- **Reproduction Suite**: [test/integration/concurrency-resilience.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/concurrency-resilience.spec.ts#L99-L121)
- **Empirical Log Evidence**:
  ```
  FAIL test/integration/concurrency-resilience.spec.ts
  ● Concurrency & System Resiliency Tests › Resiliency: Payment Retry Bounded Execution Limits
    thrown: "Exceeded timeout of 5000 ms for a test."
  ```
- **Root Cause**: `OrdersService.processPayment` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) looped up to `maxRetries = 1000` with `100ms` sleep on failure without execution bounds, blocking HTTP sockets for up to 100 seconds. Capped to `maxRetries = 5` and throws `ServiceUnavailableException` (`503 Service Unavailable`).

---

### 2. Symptom / Fallo 6: "Intermittent errors occur in certain flows" (Crash de Serialización Circular en Detalles de Orden)
- **Reproduction Suite**: [test/integration/orders-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-contract.spec.ts#L117-L128)
- **Empirical Log Evidence**:
  ```
  TypeError: Converting circular structure to JSON
      at JSON.stringify (<anonymous>)
      at OrdersService.getOrderWithFullDetails (src/orders/orders.service.ts)
  ```
- **Root Cause**: `OrdersService.getOrderWithFullDetails` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) assigns `enriched.user.latestOrder = enriched`, creating an infinite circular object reference during JSON serialization.

---

### 3. Symptom / Fallo 2: "Cache behavior does not match expectations" (Contaminación de Caché en Búsquedas de Productos)
- **Reproduction Suite**: [test/integration/products-cache-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-cache-contract.spec.ts#L50-L79)
- **Empirical Log Evidence**:
  ```
  Expected: [{"description": "Mobile phone", "name": "Smartphone"}]
  Received: [{"description": "Powerful laptop", "name": "Gaming Laptop"}]
  ```
- **Root Cause**: `ProductsService.searchProducts` in [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts) uses static cache key `'product-search'` regardless of the `query` argument, returning cached results of previous searches.

---

### 4. Symptom / Fallo 3: "Some failures produce vague or misleading error messages" (Silenciamiento de Errores en Lotes)
- **Reproduction Suite**: [test/integration/products-cache-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-cache-contract.spec.ts#L80-L97)
- **Empirical Log Evidence**:
  ```
  console.log: Error processing product
  Received: { success: true, processed: 0 }
  ```
- **Root Cause**: `ProductsService.processProductBatch` in [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts) swallows item errors into `console.log` and returns `{ success: true }` without populating failed product IDs in the HTTP response.

---

### 5. Symptom / Fallo 7 & 10: "Data is sometimes inconsistent or missing" (Sobregiro de Inventario por Peticiones Concurrentes)
- **Reproduction Suite**: [test/integration/concurrency-resilience.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/concurrency-resilience.spec.ts) & [test/integration/products-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-edge-cases.spec.ts)
- **Empirical Log Evidence**:
  ```
  Expected fulfilled: 1
  Received fulfilled: 2 (Stock corrupted to -1)
  ```
- **Root Causes**:
  1. `OrdersService.create` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) calls `updateStock` without `await` (floating promise). Concurrent requests read the same stock before DB updates complete, causing negative stock corruption.
  2. Missing negative stock check in `ProductsService.updateStock` allows stock to drop below 0.
- **Detailed Resiliency & Concurrency Resolution**:
  - **Synchronous Await Enforcement**: Enforced `await this.productsService.updateStock(...)` in `OrdersService.create` to guarantee sequential DB execution before returning HTTP response.
  - **Negative Stock Protection**: Added pre-validation in `ProductsService.updateStock` throwing `BadRequestException('Stock quantity cannot be negative')` if `quantity < 0`.
  - **Payload Item Aggregation**: Consolidated duplicate `productId` entries into a single total prior to stock checks.
  - **3-Tier Verification Locations**:
    - **Integration**: `test/integration/products-edge-cases.spec.ts` (`Validation Contract: Negative Stock Prevention`).
    - **Unit**: `test/unit/orders/orders.service.spec.ts` (`insufficient stock`) & `test/unit/products/products.service.spec.ts` (`negative stock`).
    - **E2E**: `test/e2e/orders.e2e-spec.ts` & `test/e2e/products.e2e-spec.ts` (`updateStock negative stock prevention`).

---

### 6. Symptom / Fallo 1: Excepción Cruda 500 en Registro de Email Duplicado
- **Reproduction Suite**: [test/integration/users-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/users-contract.spec.ts#L45-L60)
- **Empirical Log Evidence**:
  ```
  QueryFailedError: duplicate key value violates unique constraint "UQ_97672ac88f789774dd47f7c8be3"
  Received: 500 Internal Server Error
  ```
- **Root Cause**: `UsersService.create` in [src/users/users.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/users/users.service.ts) does not catch PostgreSQL unique constraint error `23505`, letting DB driver exceptions leak as unhandled HTTP 500 errors instead of NestJS `ConflictException` (409 Conflict).

---

### 7. Symptom / Fallo 4: Persistencia de Stock Negativo
- **Reproduction Suite**: [test/integration/products-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-edge-cases.spec.ts#L87-L96)
- **Empirical Log Evidence**:
  ```
  Received stock: -10
  Expected: BadRequestException ('Stock quantity cannot be negative')
  ```
- **Root Cause**: `ProductsService.updateStock` in [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts) assigns `product.stock = quantity` without validating `quantity >= 0`, persisting negative inventory values into the database.

---

### 8. Symptom / Fallo 5: Crash por TypeError en Árbol de Categorías sin Padre Poblado
- **Reproduction Suite**: [test/integration/products-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-edge-cases.spec.ts#L98-L142)
- **Empirical Log Evidence**:
  ```
  TypeError: Cannot read properties of undefined (reading 'id')
      at ProductsService.buildCategoryTree (src/products/products.service.ts)
  ```
- **Root Cause**: `ProductsService.buildCategoryTree` in [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts) checks `if (category.parentId)` and recurses on `category.parent` without verifying if relation `parent` is populated (`undefined`).

---

### 9. Symptom / Fallo 8: Creación de Órdenes con Ítems Vacíos
- **Reproduction Suite**: [test/integration/orders-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-edge-cases.spec.ts#L96-L102)
- **Empirical Log Evidence**:
  ```
  Received: { id: 2, status: "pending", total: 0, items: [] }
  Expected: BadRequestException ('Order must contain at least one item')
  ```
- **Root Cause**: `OrdersService.create` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) does not validate if `createOrderDto.items` is empty or missing, creating invalid $0 orders.

---

### 10. Symptom / Fallo 9: Cancelación de Orden No Idempotente (Doble Devolución)
- **Reproduction Suite**: [test/integration/orders-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-edge-cases.spec.ts#L104-L113)
- **Empirical Log Evidence**:
  ```
  Expected stockRestoredCount: 5
  Received stockRestoredCount: 10 (Restored twice on duplicate cancel requests)
  ```
- **Root Cause**: `OrdersService.cancel` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) does not check `if (order.status === OrderStatus.CANCELLED)` before iterating items and updating stock, restoring stock multiple times.

---

### 11. Symptom / Fallo 12: Creación de Subcategoría con `parentId` Inexistente o `parentId = 0`
- **Reproduction Suite**: [test/integration/products-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-edge-cases.spec.ts#L167-L173) & [test/e2e/products.e2e-spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/e2e/products.e2e-spec.ts#L273-L283)
- **Empirical Log Evidence**:
  ```
  QueryFailedError: insert or update on table "categories" violates foreign key constraint "FK_88cea2dc9c31951d06437879b40"
  Received: 500 Internal Server Error
  ```
- **Root Cause**: `ProductsService.createCategory` in [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts) used implicit falsy evaluation `if (dto.parentId)` which skipped pre-validation for `parentId = 0` or missing IDs, causing raw DB foreign key 500 errors instead of `BadRequestException` (400 Bad Request) informing that the parent category does not exist.

---

### 12. Symptom / Fallo 13: Creación de Producto con `categoryId` Inexistente
- **Reproduction Suite**: [test/integration/products-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-edge-cases.spec.ts#L167-L173) & [test/e2e/products.e2e-spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/e2e/products.e2e-spec.ts#L183-L188)
- **Empirical Log Evidence**:
  ```
  QueryFailedError: insert or update on table "products" violates foreign key constraint "FK_ff56834e735e7837715000570b7"
  Received: 500 Internal Server Error
  ```
- **Root Cause**: `ProductsService.create` in [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts) did not validate category existence before saving, causing raw DB foreign key 500 errors instead of `BadRequestException` (400 Bad Request) informing that the category does not exist.

---

### 13. Symptom / Fallo 14: Ocultamiento de Múltiples Productos Inexistentes al Crear Orden
- **Reproduction Suite**: [test/integration/orders-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-contract.spec.ts#L150-L160) & [test/unit/orders/orders.service.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/unit/orders/orders.service.spec.ts#L196-L201)
- **Empirical Log Evidence**:
  ```
  Received: 404 Not Found ("Product #6 not found")
  Expected: 400 Bad Request ("Products not found: #6, #7")
  ```
- **Root Cause**: `OrdersService.create` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) threw `NotFoundException` (404) immediately on the first missing product instead of pre-validating all product IDs and returning `BadRequestException` (400 Bad Request) listing all non-existing product IDs.

---

### 14. Symptom / Fallo 15: Ocultamiento de Múltiples Productos con Stock Insuficiente y Falta de Agregación
- **Reproduction Suite**: [test/integration/orders-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-contract.spec.ts#L150-L160) & [test/unit/orders/orders.service.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/unit/orders/orders.service.spec.ts#L171-L184)
- **Empirical Log Evidence**:
  ```
  Received: 400 Bad Request ("Not enough stock for Product 1")
  Expected: 400 Bad Request ("Not enough stock for: Product 1 (...), Product 2 (...)")
  ```
- **Root Cause**: `OrdersService.create` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) stopped at the first product with insufficient stock without consolidating duplicate `productId` items in the payload or collecting all failing products.

---

### 15. Symptom / Fallo 16: Permitir Procesar Pago en Órdenes Canceladas o Confirmadas
- **Reproduction Suite**: [test/integration/orders-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-edge-cases.spec.ts#L104-L110) & [test/e2e/orders.e2e-spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/e2e/orders.e2e-spec.ts#L227-L232)
- **Empirical Log Evidence**:
  ```
  Received: 201 Created ({ success: true }), order status changed from cancelled to confirmed
  Expected: 400 Bad Request ("Cannot process payment for an order with status 'cancelled'")
  ```
- **Root Cause**: `OrdersService.processPayment` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) did not validate `order.status === OrderStatus.PENDING`, allowing payment processing on cancelled or confirmed orders.

---

### 16. Symptom / Fallo 17: Respuesta 404 Not Found al Actualizar Estado con `orderId` Inexistente
- **Reproduction Suite**: [test/integration/orders-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-edge-cases.spec.ts#L123-L125) & [test/e2e/orders.e2e-spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/e2e/orders.e2e-spec.ts#L258-L264)
- **Empirical Log Evidence**:
  ```
  Received: 404 Not Found ("Order #3 not found")
  Expected: 400 Bad Request ("Order #3 does not exist or orderId is invalid")
  ```
- **Root Cause**: `OrdersService.updateStatus` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) used `this.findOne(id)` which threw `NotFoundException` (404 Not Found) instead of `BadRequestException` (400 Bad Request) informing that the provided `orderId` is invalid.

---

### 17. Symptom / Fallo 18: Excepción Cruda 500, Transiciones Inválidas e Idempotencia en Estado de Orden
- **Reproduction Suite**: [test/integration/orders-edge-cases.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-edge-cases.spec.ts#L125-L148) & [test/e2e/orders.e2e-spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/e2e/orders.e2e-spec.ts#L266-L308)
- **Empirical Log Evidence**:
  ```
  Received: 500 Internal Server Error (QueryFailedError: invalid input value for enum order_status_enum: "INVALID")
  Expected: 400 Bad Request ("Invalid status. Valid status options for update are: shipped, delivered")
  ```
- **Root Cause**: `OrdersService.updateStatus` in [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts) did not validate if `status` was `shipped` or `delivered`, nor did it enforce valid state transitions (`confirmed` -> `shipped` and `shipped` -> `delivered`) or idempotency (`if (order.status === status) return order;`), allowing invalid enum strings to throw raw PostgreSQL 500 errors and permitting illegal status updates from `pending`, `cancelled`, or `delivered`.

---

## Stage 2: Proposed Code Fixes

### 1. [Orders Component](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts)

#### [MODIFY] [src/orders/orders.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts)
- **Fix Circular JSON**: In `getOrderWithFullDetails`, map `enriched.user` to a clean DTO representation excluding `latestOrder` circular reference.
- **Pre-Creation Validation & Aggregation**:
  - Validate `userId` exists, throwing `BadRequestException('User #... not found')` (400 Bad Request) if invalid.
  - Consolidate duplicate `productId` items by summing quantities.
  - Pre-validate all item product IDs, collecting all missing IDs and throwing `BadRequestException('Products not found: #6, #7')` (400 Bad Request) if any are missing.
  - Pre-validate stock availability for all aggregated items, collecting all failing items and throwing `BadRequestException('Not enough stock for: ...')` (400 Bad Request) detailing all failing products.
- **Await Stock Update & Payload Validation**: Validate `dto.items` is non-empty (`BadRequestException`) and `await this.productsService.updateStock(...)` inside `create()`.
- **Reject Payment Processing on Non-Pending Orders**: Check `if (order.status !== OrderStatus.PENDING)` in `processPayment`, rejecting payment processing for cancelled or confirmed orders with `BadRequestException` (400 Bad Request).
- **Bound Payment Retries & Semantic Exception**: Cap payment retries to `maxRetries = 5` to prevent blocking HTTP sockets, and throw `ServiceUnavailableException('Payment service unavailable')` (`503 Service Unavailable`) when retries exhaust.
- **Strict Status Update Rules, State Machine & Idempotency**:
  - In `updateStatus`, catch `findOne` 404 and throw `BadRequestException('Order #... does not exist or orderId is invalid')` (400 Bad Request) when `orderId` is invalid.
  - Validate target status is either `shipped` or `delivered`, throwing `BadRequestException('Invalid status. Valid status options for update are: shipped, delivered')` (400 Bad Request) otherwise.
  - Enforce idempotency: check `if (order.status === status) return order;` to return HTTP 200 OK cleanly when updating an order that is already in target `shipped` or `delivered` state.
  - Enforce `confirmed` -> `shipped` transition, throwing `BadRequestException('Only confirmed orders can be updated to shipped')` (400 Bad Request) if order is not `confirmed`.
  - Enforce `shipped` -> `delivered` transition, throwing `BadRequestException('Only shipped orders can be updated to delivered')` (400 Bad Request) if order is not `shipped`.
- **Idempotent Cancellation**: Check if `order.status === OrderStatus.CANCELLED` before restoring stock to ensure idempotency.

---

### 2. [Products Component](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts)

#### [MODIFY] [src/products/products.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts)
- **Query-Specific Cache Key**: Change cache key in `searchProducts` from `'product-search'` to `product-search:${query.toLowerCase().trim()}`.
- **Pre-Validate `parentId` (including `parentId = 0`)**: In `createCategory`, check `if (dto.parentId !== undefined && dto.parentId !== null)` and call `await this.findCategory(dto.parentId)`, throwing `BadRequestException('Cannot create category because parent category #${dto.parentId} does not exist')` (400 Bad Request) if missing.
- **Pre-Validate `categoryId`**: In `create`, check `if (createProductDto.categoryId !== undefined && createProductDto.categoryId !== null)` and call `await this.findCategory(createProductDto.categoryId)`, throwing `BadRequestException('Cannot create product because category #${createProductDto.categoryId} does not exist')` (400 Bad Request) if missing.
- **Explicit Batch Error Reporting**: In `processProductBatch`, capture caught item errors in a `failedProductIds` array and return `{ success: true, processed: N, failedProductIds: [...] }`.
- **Negative Stock Validation**: In `updateStock`, throw `BadRequestException('Stock quantity cannot be negative')` if `newStock < 0`.
- **Category Tree Null Safety**: In `buildCategoryTree`, safely check `if (category.parent)` before recursing on parent.

---

### 3. [Users Component](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/users/users.service.ts)

#### [MODIFY] [src/users/users.service.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/users/users.service.ts)
- **Catch Duplicate Email DB Error**: Wrap `this.usersRepository.save` in a try/catch block and throw `ConflictException('User with this email already exists')` if Postgres error code is `'23505'`.

---

## Stage 3: 3-Tier Verification Plan

Once Stage 2 code fixes are applied, execute all 3 test suites to verify 100% pass rate:

1. **Unit Tests (100% Code Coverage)**:
   ```bash
   pnpm test:cov
   ```
   *Target*: 8 passed suites, 87 passed tests, 100% statement, branch, function, and line coverage.

2. **Integration & Contract Test Suite**:
   ```bash
   pnpm test:integration:cov
   ```
   *Target*: All 6 integration suites pass (`orders-contract`, `products-cache-contract`, `concurrency-resilience`, `users-contract`, `products-edge-cases`, `orders-edge-cases`).

3. **End-to-End Test Suite**:
   ```bash
   pnpm test:e2e:cov
   ```
   *Target*: All 4 E2E suites pass (`app`, `users`, `products`, `orders`).
