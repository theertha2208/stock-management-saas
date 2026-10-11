# Stock Management SaaS

A full-stack, multi-tenant Stock Management SaaS application built with Django REST Framework, React, PostgreSQL, and Docker.

The application enables businesses to manage products, categories, suppliers, warehouses, stock movements, employees, and inventory reports through a responsive web interface.

## Technology Stack

**Frontend**
- React with Vite
- JavaScript
- CSS

**Backend**
- Python
- Django
- Django REST Framework
- JWT authentication

**Database**
- PostgreSQL 17

**Development Tools**
- Docker and Docker Compose
- Git and GitHub
- Ruff for Python linting
- ESLint for frontend linting

## Key Features

- Multi-tenant company-based inventory management
- User registration and login
- JWT-based authentication
- Role-based access control for Admin, Manager, and Staff
- Product and category management
- Supplier management
- Warehouse management
- Stock IN and OUT operations
- Inventory movement history
- Low-stock alerts
- Dashboard statistics
- Inventory reports
- Employee management and invitations
- Responsive interface for desktop and mobile devices
- REST API documentation using Swagger

## Project Structure

```text
stock-management-saas/
├── backend/
│   ├── accounts/
│   ├── config/
│   ├── inventory/
│   │   ├── management/
│   │   │   └── commands/
│   │   │       └── seed_demo.py
│   │   └── tests/
│   ├── Dockerfile
│   ├── manage.py
│   ├── requirements.txt
│   └── ruff.toml
├── frontend/
│   ├── public/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

## Local Setup Using Docker

### Prerequisites

- Git
- Docker Desktop with Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/theertha2208/stock-management-saas.git
cd stock-management-saas
```

### 2. Configure Environment Variables

Create a `.env` file in the project root using `.env.example` as a reference.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update the values according to your local environment.

Use a strong, unique Django secret key and PostgreSQL password.

Do not commit `.env` or real credentials to GitHub.

### 3. Start the Application

Ensure Docker Desktop is running.

From the project root, execute:

```bash
docker compose up -d --build
```

This builds and starts the services defined in `docker-compose.yml`.

Check their status:

```bash
docker compose ps
```

### 4. Run Database Migrations

```bash
docker compose exec backend python manage.py migrate
```

### 5. Load Demo Data

The project includes a Django management command for preparing demonstration data:

```bash
docker compose exec backend python manage.py seed_demo
```

Use the demo accounts configured by the seed command when testing the application.

### 6. Access the Application

**Frontend**

http://localhost:5173/

**Backend API**

http://localhost:8000/

**Swagger API Documentation**

http://localhost:8000/api/docs/

These URLs assume the default local port configuration.

## Running Tests

### Backend Tests

From the project root:

```bash
docker compose exec backend python manage.py test inventory.tests.test_api_security inventory.tests.test_stock_services -v 2
```

The security and stock service test suites contain 28 tests.

### Backend Linting

```bash
docker compose exec backend ruff check .
```

### Frontend Linting

From the frontend directory:

```bash
npm install
npm run lint
```

### Frontend Production Build

```bash
npm run build
```

## Multi-Tenant Architecture

The application is designed for company-based inventory management.

Company-specific data is separated through backend access controls and query filtering to prevent users from accessing inventory records belonging to other companies.

## User Roles

**Admin**
- Manage company employees and invitations
- Manage company inventory and related resources

**Manager and Staff**
- Access permitted inventory features according to backend role permissions

All authorization rules are enforced by the backend.

## Inventory Management

The application supports stock movements across warehouses, allowing businesses to record incoming and outgoing stock.

Inventory reports and dashboard information help users monitor stock levels, product availability, and inventory activity.

## Mobile Support

The frontend includes responsive layouts intended for desktop and mobile screens.

To test the mobile interface:

1. Open the frontend URL in a browser.
2. Open Developer Tools.
3. Enable responsive device mode.
4. Select a mobile screen size.
5. Test navigation and inventory management pages.

## Security

- JWT authentication
- Role-based backend permissions
- Company-based data isolation
- Environment-based secrets and database configuration
- Django password validation
- API authentication and authorization checks

## Development Notes

- The project is configured for local development and demonstration.
- Production deployment requires secure hosting, HTTPS, appropriate allowed-host and CORS settings, and production-ready secrets.
- Invitation emails may be displayed in backend console output during development, depending on the configured email backend.
- Localhost URLs are not publicly accessible deployment links.

## GitHub Repository

https://github.com/theertha2208/stock-management-saas

## Author

Theertha A
