# Centralized TypeScript Types

This folder contains all shared TypeScript types for the My Academy project, organized by domain and purpose.

## Structure

```
types/
├── api.ts          # API utilities (jsonBigInt, error handling)
├── common.ts       # Common shared types (SelectOption, Address)
├── config.ts       # App config types (MenuItem, Settings)
├── enums.ts        # Re-exports of Prisma enums (Gender, DocumentType, etc.)
├── index.ts        # Main entry - re-exports all types
├── domain/         # Domain-specific types
│   ├── student.ts
│   ├── event.ts
│   ├── location.ts
│   ├── tenant.ts
│   ├── employee.ts
│   ├── skill.ts
│   ├── level.ts
│   ├── batch.ts
│   ├── course.ts
│   ├── program.ts
│   └── index.ts
├── next-auth.d.ts  # NextAuth module augmentation
└── nodemailer.d.ts # Nodemailer type declarations
```

## Usage

```ts
// Import from main entry
import { jsonBigInt, getErrorMessage } from '@/types/api';
import type { StudentSelectOption, EventSelectOption } from '@/types/domain';
import type { Gender } from '@/types/enums';

// Or import from specific modules
import type { TenantWithSmtp } from '@/types/domain/tenant';
```

## Guidelines

- **Domain types**: Use for API responses, form data, and component props
- **API types**: Use `jsonBigInt<T>()` for BigInt serialization, `getErrorMessage()` for error handling
- **Enums**: Import Prisma enums from `@/types/enums` for type-safe form values
