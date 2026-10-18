# BudgetWizard



### Prerequisites

- Python 3.8+
- Node.js 16+
- MySQL 8.0+

### Database Setup

#### For New Installations

1. Create MySQL database:
```sql
CREATE DATABASE budgetwizard;
```

2. Run the schema:
```bash
mysql -u root -p budgetwizard < database/schema.sql
```

### Backend Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables (create `.env` file):
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=XxbudgetwizardxX
DB_NAME=budgetwizard
```

3. Run the Flask server:
```bash
cd backend
python app.py
```

The backend will run on http://localhost:5000

### Frontend Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the React development server:
```bash
npm start
```

The frontend will run on http://localhost:3000

## Features

### Proposal Management
- Create research grant proposals with detailed budget breakdowns
- Support for multiple years (up to 5 years)
- Personnel compensation tracking (PI, Co-PIs, staff, students)
- Fringe benefits calculation
- Equipment, travel, supplies, and other direct costs
- Subaward/consortium management
- Excel export functionality



