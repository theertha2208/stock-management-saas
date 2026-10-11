
# Stock Management SaaS

A full-stack, multi-user Stock Management SaaS application built using Django REST Framework, React, PostgreSQL, and Docker.

The application helps businesses manage products, suppliers, warehouses, stock movements, and inventory reports through a responsive web interface.

## Technology Stack

**Frontend**
- React (Vite)
- JavaScript
- CSS

**Backend**
- Python
- Django
- Django REST Framework
- JWT Authentication

**Database**
- PostgreSQL 17

**Tools**
- Docker Compose
- Git and GitHub

## Key Features

- User registration and login
- JWT-based authentication
- Role-based access control
- Product and category management
- Supplier management
- Warehouse management
- Stock IN and OUT operations
- Inventory movement history
- Low-stock alerts
- Dashboard statistics
- Inventory reports
- User management and invitations
- Responsive mobile-friendly interface

## Project Structure

```text
stock-management-saas/
├── backend/
│   ├── accounts/
│   ├── config/
│   ├── inventory/
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Local Setup

### Prerequisites

- Python
- Node.js and npm
- Docker Desktop
- Git

### 1. Clone the repository

```bash
git clone https://github.com/theertha2208/stock-management-saas.git
cd stock-management-saas
```

### 2. Configure environment variables

Create a `.env` file in the project root.

Required variables:

```env
DJANGO_SECRET_KEY=replace-with-a-secure-random-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

POSTGRES_DB=stock_management
POSTGRES_USER=stock_user
POSTGRES_PASSWORD=replace-with-a-strong-password
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

These values are examples. Use your own secure credentials.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Set up the Django backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start Django:

```bash
python manage.py runserver
```

Backend URL: http://127.0.0.1:8000/

### 5. Set up the React frontend

Open a new terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: http://localhost:5173/

## Running Backend Tests

From the backend directory:

```bash
python manage.py test inventory.tests.test_api_security inventory.tests.test_stock_services
```

## Mobile Support

The application includes a responsive interface with mobile navigation, dashboard cards, and inventory management pages.

To test the mobile layout locally, open the frontend URL using a mobile browser or your browser's responsive device mode.

## Security

- JWT-based authentication
- Role-based permissions
- Environment-based secrets and database credentials
- Password validation
- Django REST Framework authentication and permission controls

## Deployment

The application is configured for local development. Production deployment requires hosting for the Django backend, React frontend, and PostgreSQL database, along with production environment configuration.

## Author

Theertha A
