# EnviroCentric Frontend

React frontend application for the EnviroCentric environmental sample management system.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server  
- **Tailwind CSS** - Styling framework
- **React Router** - Client-side routing
- **Axios** - HTTP client for API requests

## Features

- 🔐 **Authentication** - JWT-based auth with automatic token refresh
- 👥 **User Management** - Role-based access control
- 📊 **Project Management** - Environmental project tracking
- 🧪 **Sample Collection** - Laboratory sample management
- 📱 **Responsive Design** - Mobile-friendly interface

## Development

### Prerequisites
- Node.js 18+
- Docker (for running with backend)

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:5173
```

### Environment Variables

Create a `.env` file:
```env
VITE_API_URL=http://localhost:8000
```

### Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Route components
├── services/      # API service layer
├── context/       # React contexts (Auth, Theme, etc.)
├── hooks/         # Custom React hooks
└── routes/        # Route configuration
```

### Authentication

The app uses JWT tokens stored in localStorage with automatic refresh:
- Access tokens expire in 30 minutes
- Refresh tokens expire in 30 days
- Automatic redirect to login on token expiry

### Building

```bash
# Production build
npm run build

# Preview production build
npm run preview
```
