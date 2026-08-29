# Action Plan - Root Cause Resolution & Verification (`INSTRUCTIONS.md`)

This action plan addresses all requirements in `INSTRUCTIONS.md`, focusing first on **Getting Started** (reproducing reported symptoms empirically via automated integration/E2E test suites and log extraction) before executing targeted, root-cause code fixes across all microservice components.

---

## Stage 1: Getting Started - Reproduction & Empirical Evidence

We have empirically reproduced all reported symptoms listed in `INSTRUCTIONS.md` via dedicated test suites in `test/integration/` and `test/e2e/`.

### 1. Symptom: "Some requests are extremely slow or never complete"
- **Reproduction Suite**: [test/integration/concurrency-resilience.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/concurrency-resilience.spec.ts#L108-L125)
- **Empirical Log Evidence**:
  ```
  FAIL test/integration/concurrency-resilience.spec.ts
  ● Concurrency & System Resiliency Tests › Resiliency: Payment Retry Bounded Execution Limits
    thrown: "Exceeded timeout of 5000 ms for a test."
  ```
- **Root Cause**: `OrdersService.processPayment` in [src/orders/orders.service.ts:133-149](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts#L133-L149) loops up to `maxRetries = 1000` with `100ms` sleep on failure without exponential backoff or gateway execution bounds.

---

### 2. Symptom: "Intermittent errors occur in certain flows"
- **Reproduction Suite**: [test/integration/orders-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/orders-contract.spec.ts#L110-L125)
- **Empirical Log Evidence**:
  ```
  TypeError: Converting circular structure to JSON
      at JSON.stringify (<anonymous>)
      at OrdersService.getOrderWithFullDetails (src/orders/orders.service.ts:156:28)
  ```
- **Root Cause**: `OrdersService.getOrderWithFullDetails` in [src/orders/orders.service.ts:154](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts#L154) assigns `enriched.user.latestOrder = enriched`, creating an infinite circular object reference during serialization.

---

### 3. Symptom: "Cache behavior does not match expectations"
- **Reproduction Suite**: [test/integration/products-cache-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-cache-contract.spec.ts#L50-L79)
- **Empirical Log Evidence**:
  ```
  Expected: [{"description": "Mobile phone", "name": "Smartphone"}]
  Received: [{"description": "Powerful laptop", "name": "Gaming Laptop"}]
  ```
- **Root Cause**: `ProductsService.searchProducts` in [src/products/products.service.ts:74-79](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts#L74-L79) uses static cache key `'product-search'` regardless of the `query` argument.

---

### 4. Symptom: "Some failures produce vague or misleading error messages"
- **Reproduction Suite**: [test/integration/products-cache-contract.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/products-cache-contract.spec.ts#L80-L97)
- **Empirical Log Evidence**:
  ```
  console.log: Error processing product
  Received: { success: true, processed: 0 }
  ```
- **Root Cause**: `ProductsService.processProductBatch` in [src/products/products.service.ts:121-124](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/products/products.service.ts:121-124) swallows errors into `console.log` and returns `{ success: true }` without populating error lists or failed IDs.

---

### 5. Symptom: "Data is sometimes inconsistent or missing"
- **Reproduction Suite**: [test/integration/concurrency-resilience.spec.ts](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/test/integration/concurrency-resilience.spec.ts#L50-L106)
- **Empirical Log Evidence**:
  ```
  Expected fulfilled: 1
  Received fulfilled: 2 (Stock corrupted to -1)
  ```
- **Root Causes**:
  1. `OrdersService.create` in [src/orders/orders.service.ts:89](file:///Volumes/Mac-Storage/zubale/product-engineer-challenge/src/orders/orders.service.ts#L89) calls `this.productsService.updateStock` without `await` (floating promise).
  2. Missing DB transactions / optimistic/pessimistic locking during concurrent stock updates allows double-deduction.

---

### 6. Additional Hidden Edge Cases & Validation Failures Identified
- **Duplicate Email DB Exception**: `UsersService.create` lets raw Postgres unique constraint error `23505` bubble up as a 500 error instead of throwing NestJS `ConflictException` (409).
- **Negative Stock Update**: `ProductsService.updateStock` does not validate that `quantity >= 0`, persisting negative stock.
- **Unpopulated Parent Category Tree Crash**: `ProductsService.getCategoryTree` crashes with `TypeError` when `parentId` is present but relation `parent` is undefined.
- **Non-Existing `parentId` Foreign Key Error (including `parentId = 0`)**: `ProductsService.createCategory` uses implicit falsy check `if (dto.parentId)` skipping validation when `parentId = 0` or missing, causing PostgreSQL foreign key constraint `23503` 500 error instead of `BadRequestException` (400 Bad Request) informing that the parent category does not exist.
- **Non-Existing `categoryId` Foreign Key Error**: `ProductsService.create` allows non-existing `categoryId` to throw raw PostgreSQL `23503` 500 error instead of `BadRequestException` (400 Bad Request) informing that the category does not exist.
- **Invalid `userId` in Order Creation**: `OrdersService.create` throws `BadRequestException` (400 Bad Request) when `userId` is invalid.
- **Single-Product Error Output on Order Creation with Missing Products**: `OrdersService.create` throws `404 Not Found` for the first missing product instead of `400 Bad Request` reporting **all** non-existing product IDs.
- **Single-Product Error Output on Insufficient Stock**: `OrdersService.create` stops at the first insufficient stock product instead of `400 Bad Request` reporting **all** failing products with requested vs. available quantities.
- **Unvalidated Order Item Aggregation**: Duplicate items with the same `productId` in an order payload are not consolidated prior to stock validation.
- **Payment Processing on Cancelled Orders**: `OrdersService.processPayment` allows processing payments on cancelled or confirmed orders and updates status to `CONFIRMED`.
- **Empty Order Creation**: `OrdersService.create` allows creating orders with `items: []` and total $0.
- **Non-Idempotent Order Cancellation**: `OrdersService.cancel` called concurrently on a pending order restores product stock twice.

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
- **Bound Payment Retries**: Cap payment retries to `maxRetries = 5` to prevent blocking HTTP sockets.
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
   *Target*: 8 passed suites, 81 passed tests, 100% statement, branch, function, and line coverage.

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
