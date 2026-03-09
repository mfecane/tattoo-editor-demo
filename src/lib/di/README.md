# DI Container

Lightweight TypeScript DI container with singleton support.

## Usage

```typescript
import { container, lazy } from '@/lib/di/container'

// Register providers
container.registerSingleton('CONFIG', { useValue: { apiUrl: 'https://api.example.com' } })
container.registerSingleton('DatabaseService', { useClass: DatabaseService })
container.registerSingleton('UserService', {
	useFactory: (c) => new UserService(c.resolve('DatabaseService'))
})

// Resolve instances
const config = container.resolve('CONFIG')
const userService = container.resolve('UserService')
```

## Provider Types

### useValue
```typescript
container.registerSingleton('CONFIG', { useValue: { apiUrl: '...' } })
```

### useClass
```typescript
container.registerSingleton('DatabaseService', { useClass: DatabaseService })
```

### useFactory
```typescript
container.registerSingleton('UserService', {
	useFactory: (c) => new UserService(c.resolve('DatabaseService'))
})
```

## Circular Dependencies

Use `lazy()` to break circular dependencies:

```typescript
container.registerSingleton('ServiceA', {
	useFactory: (c) => new ServiceA(lazy(c, 'ServiceB'))
})

container.registerSingleton('ServiceB', {
	useFactory: (c) => new ServiceB(lazy(c, 'ServiceA'))
})
```

## API

-   `registerSingleton<T>(token, provider)` - Register singleton
-   `resolve<T>(token)` - Resolve instance (throws on cycles)
-   `lazy<T>(container, token)` - Create lazy resolver function
-   `reset()` - Clear all (for testing)
