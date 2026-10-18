-- BudgetWizard Database Schema

-- Institutions table
CREATE TABLE institutions (
    institution_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    fa_rate DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role ENUM('PI', 'Co-PI', 'Admin') NOT NULL,
    institution_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id)
);

-- Proposals table
CREATE TABLE proposals (
    proposal_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(300) NOT NULL,
    pi_id INT NOT NULL,
    co_pi_ids TEXT,
    agency VARCHAR(100),
    total_duration_years INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pi_id) REFERENCES users(user_id)
);

-- Budgets table
CREATE TABLE budgets (
    budget_id INT PRIMARY KEY AUTO_INCREMENT,
    proposal_id INT NOT NULL,
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    budget_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposal_id) REFERENCES proposals(proposal_id)
);

-- Budget Items table
CREATE TABLE budget_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    budget_id INT NOT NULL,
    item_type ENUM('Salary', 'Tuition', 'Travel', 'Equipment', 'Supplies', 'Other') NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    year INT NOT NULL,
    person_id INT,
    person_type ENUM('Student', 'Faculty', 'Staff_Postdoc') DEFAULT 'Faculty',
    effort_percentage DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(budget_id),
    FOREIGN KEY (person_id) REFERENCES users(user_id)
);

-- Rates table (for Fringe, FA, SHIP, International fees)
CREATE TABLE rates (
    rate_id INT PRIMARY KEY AUTO_INCREMENT,
    rate_type ENUM('Fringe', 'FA', 'SHIP', 'International') NOT NULL,
    rate_amount DECIMAL(8,4) NOT NULL,
    year INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Reference Table
CREATE TABLE students (
    student_id INT PRIMARY KEY AUTO_INCREMENT,
    student_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    student_type ENUM('Graduate_Student', 'Undergraduate') NOT NULL,
    residency_status ENUM('In_State', 'Out_Of_State', 'International') NOT NULL,
    program VARCHAR(200),
    enrollment_status ENUM('Full_Time', 'Part_Time') DEFAULT 'Full_Time',
    start_date DATE,
    expected_graduation_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_type (student_type),
    INDEX idx_residency (residency_status)
);

-- Tuition and Fee Schedules (Semester-specific, In-State vs Out-of-State)
CREATE TABLE tuition_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    academic_year INT NOT NULL,
    semester ENUM('Fall', 'Spring', 'Summer') NOT NULL,
    residency_status ENUM('In_State', 'Out_Of_State', 'International') NOT NULL,
    student_type ENUM('Graduate_Student', 'Undergraduate') NOT NULL,
    tuition_amount DECIMAL(10,2) NOT NULL,
    fees_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_schedule (academic_year, semester, residency_status, student_type),
    INDEX idx_year_semester (academic_year, semester)
);

-- Annual Tuition Increase Projections
CREATE TABLE tuition_increase_projections (
    projection_id INT PRIMARY KEY AUTO_INCREMENT,
    base_year INT NOT NULL,
    projected_year INT NOT NULL,
    residency_status ENUM('In_State', 'Out_Of_State', 'International') NOT NULL,
    student_type ENUM('Graduate_Student', 'Undergraduate') NOT NULL,
    increase_percentage DECIMAL(5,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_projection (base_year, projected_year, residency_status, student_type),
    INDEX idx_base_year (base_year),
    INDEX idx_projected_year (projected_year)
);

-- Travel Profiles - Domestic
CREATE TABLE travel_profiles_domestic (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    location_name VARCHAR(200) NOT NULL,
    state VARCHAR(50),
    city VARCHAR(100),
    per_diem_rate DECIMAL(8,2) NOT NULL,
    lodging_cap_per_night DECIMAL(8,2) NOT NULL,
    airfare_estimate DECIMAL(8,2),
    ground_transportation_estimate DECIMAL(8,2) DEFAULT 0.00,
    effective_year INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_location (location_name),
    INDEX idx_year (effective_year)
);

-- Travel Profiles - International
CREATE TABLE travel_profiles_international (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    per_diem_rate DECIMAL(8,2) NOT NULL,
    lodging_cap_per_night DECIMAL(8,2) NOT NULL,
    airfare_estimate DECIMAL(8,2),
    ground_transportation_estimate DECIMAL(8,2) DEFAULT 0.00,
    visa_fees DECIMAL(8,2) DEFAULT 0.00,
    currency_code VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    effective_year INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_country (country),
    INDEX idx_year (effective_year)
);

-- Subawards table
CREATE TABLE subawards (
    subaward_id INT PRIMARY KEY AUTO_INCREMENT,
    budget_id INT NOT NULL,
    institution_id INT NOT NULL,
    subaward_amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(budget_id),
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id)
);

-- Approved Budget Line Items (approved amounts for each category)
CREATE TABLE approved_budget_lines (
    line_id INT PRIMARY KEY AUTO_INCREMENT,
    budget_id INT NOT NULL,
    cost_category VARCHAR(100) NOT NULL,
    approved_amount DECIMAL(15,2) NOT NULL,
    committed_amount DECIMAL(15,2) DEFAULT 0.00,
    spent_amount DECIMAL(15,2) DEFAULT 0.00,
    year INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(budget_id),
    INDEX idx_budget_category (budget_id, cost_category)
);

-- Federal Cost Categories and Restrictions
CREATE TABLE federal_cost_categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(200) NOT NULL,
    description TEXT,
    agency VARCHAR(100),
    is_allowable BOOLEAN DEFAULT TRUE,
    requires_prior_approval BOOLEAN DEFAULT FALSE,
    max_percentage DECIMAL(5,2),
    restrictions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- University Policy Constraints
CREATE TABLE university_policies (
    policy_id INT PRIMARY KEY AUTO_INCREMENT,
    policy_name VARCHAR(200) NOT NULL,
    policy_type ENUM('Spending_Threshold', 'Procurement', 'Prior_Approval', 'Time_Restriction', 'Other') NOT NULL,
    cost_category VARCHAR(100),
    threshold_amount DECIMAL(15,2),
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_level ENUM('PI', 'Department', 'Dean', 'Provost', 'VPR') DEFAULT 'PI',
    time_restriction_start DATE,
    time_restriction_end DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (Expenditure Requests)
CREATE TABLE transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    budget_id INT NOT NULL,
    requested_by INT NOT NULL,
    cost_category VARCHAR(100) NOT NULL,
    budget_line_id INT,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    vendor VARCHAR(200),
    transaction_date DATE,
    status ENUM('Pending', 'Approved', 'Rejected', 'Cancelled') DEFAULT 'Pending',
    rejection_reason TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    validation_errors TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(budget_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    FOREIGN KEY (budget_line_id) REFERENCES approved_budget_lines(line_id),
    INDEX idx_budget_status (budget_id, status)
);

-- Grant Personnel (faculty and staff involved in the grant)
CREATE TABLE grant_personnel (
    personnel_id INT PRIMARY KEY AUTO_INCREMENT,
    proposal_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('PI', 'Co-PI', 'Senior_Personnel', 'Postdoc', 'Graduate_Student', 'Undergraduate', 'Staff') NOT NULL,
    effort_percentage DECIMAL(5,2),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposal_id) REFERENCES proposals(proposal_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE KEY unique_proposal_user (proposal_id, user_id)
);

-- Subaward Post-Award Management
CREATE TABLE subaward_management (
    subaward_mgmt_id INT PRIMARY KEY AUTO_INCREMENT,
    subaward_id INT NOT NULL,
    budget_id INT NOT NULL,
    subaward_number VARCHAR(100),
    subrecipient_institution_id INT NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    committed_amount DECIMAL(15,2) DEFAULT 0.00,
    spent_amount DECIMAL(15,2) DEFAULT 0.00,
    start_date DATE,
    end_date DATE,
    status ENUM('Active', 'Closed', 'Suspended') DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subaward_id) REFERENCES subawards(subaward_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(budget_id),
    FOREIGN KEY (subrecipient_institution_id) REFERENCES institutions(institution_id)
);

-- Test Universities
INSERT INTO institutions (name, fa_rate) VALUES 
('University of Example', 50.00),
('State University', 48.50),
('Tech Institute', 52.00),
('Research University', 55.00),
('Partner University', 25.50),
('Collaborative College', 30.00),
('Metropolitan University', 45.00),
('Coastal State University', 47.00),
('Midwest Research Institute', 51.00),
('Pacific University', 49.00);

INSERT INTO users (username, email, first_name, last_name, role, institution_id) VALUES 
('admin', 'admin@university.edu', 'Admin', 'User', 'Admin', 1),
-- Principal Investigators (Faculty)
('pi1', 'pi1@university.edu', 'John', 'Smith', 'PI', 1),
('pi2', 'pi2@university.edu', 'Michael', 'Johnson', 'PI', 1),
('pi3', 'pi3@university.edu', 'Sarah', 'Williams', 'PI', 1),
('pi4', 'pi4@university.edu', 'David', 'Brown', 'PI', 1),
('pi5', 'pi5@university.edu', 'Emily', 'Davis', 'PI', 1),
('pi6', 'pi6@university.edu', 'Robert', 'Miller', 'PI', 1),
('pi7', 'pi7@university.edu', 'Jennifer', 'Wilson', 'PI', 1),
('pi8', 'pi8@university.edu', 'Christopher', 'Moore', 'PI', 1),
-- Co-Principal Investigators
('cpi1', 'cpi1@university.edu', 'Jane', 'Doe', 'Co-PI', 1),
('cpi2', 'cpi2@university.edu', 'James', 'Taylor', 'Co-PI', 1),
('cpi3', 'cpi3@university.edu', 'Lisa', 'Anderson', 'Co-PI', 1),
('cpi4', 'cpi4@university.edu', 'William', 'Thomas', 'Co-PI', 1),
('cpi5', 'cpi5@university.edu', 'Amanda', 'Jackson', 'Co-PI', 1),
('cpi6', 'cpi6@university.edu', 'Thomas', 'White', 'Co-PI', 1),
('cpi7', 'cpi7@university.edu', 'Michelle', 'Harris', 'Co-PI', 1),
('cpi8', 'cpi8@university.edu', 'Matthew', 'Martin', 'Co-PI', 1);

INSERT INTO rates (rate_type, rate_amount, year, description) VALUES 
-- Fringe rates by year (typically increase slightly each year)
('Fringe', 0.5000, 2024, 'Fringe benefit rate 2024'),
('Fringe', 0.5100, 2025, 'Fringe benefit rate 2025'),
('Fringe', 0.5200, 2026, 'Fringe benefit rate 2026'),
('Fringe', 0.5300, 2027, 'Fringe benefit rate 2027'),
('Fringe', 0.5400, 2028, 'Fringe benefit rate 2028'),
-- Facilities & Administrative rates by year
('FA', 0.5000, 2024, 'Facilities & Administrative rate 2024'),
('FA', 0.5100, 2025, 'Facilities & Administrative rate 2025'),
('FA', 0.5200, 2026, 'Facilities & Administrative rate 2026'),
('FA', 0.5300, 2027, 'Facilities & Administrative rate 2027'),
('FA', 0.5400, 2028, 'Facilities & Administrative rate 2028'),
-- Student Health Insurance Program (SHIP) rates by year
('SHIP', 1200.00, 2024, 'Student Health Insurance Program 2024'),
('SHIP', 1236.00, 2025, 'Student Health Insurance Program 2025 (3% increase)'),
('SHIP', 1273.08, 2026, 'Student Health Insurance Program 2026 (3% increase)'),
('SHIP', 1311.27, 2027, 'Student Health Insurance Program 2027 (3% increase)'),
('SHIP', 1350.61, 2028, 'Student Health Insurance Program 2028 (3% increase)'),
-- International student fees by year
('International', 200.00, 2024, 'International student fee 2024'),
('International', 206.00, 2025, 'International student fee 2025 (3% increase)'),
('International', 212.18, 2026, 'International student fee 2026 (3% increase)'),
('International', 218.55, 2027, 'International student fee 2027 (3% increase)'),
('International', 225.10, 2028, 'International student fee 2028 (3% increase)');

-- Sample Tuition Schedules (2024-2025 Academic Year)
INSERT INTO tuition_schedules (academic_year, semester, residency_status, student_type, tuition_amount, fees_amount, total_amount, description) VALUES
-- Graduate Students - In-State
(2024, 'Fall', 'In_State', 'Graduate_Student', 6500.00, 500.00, 7000.00, 'Graduate in-state fall semester 2024'),
(2024, 'Spring', 'In_State', 'Graduate_Student', 6500.00, 500.00, 7000.00, 'Graduate in-state spring semester 2024'),
(2024, 'Summer', 'In_State', 'Graduate_Student', 3250.00, 250.00, 3500.00, 'Graduate in-state summer semester 2024'),
-- Graduate Students - Out-of-State
(2024, 'Fall', 'Out_Of_State', 'Graduate_Student', 13000.00, 500.00, 13500.00, 'Graduate out-of-state fall semester 2024'),
(2024, 'Spring', 'Out_Of_State', 'Graduate_Student', 13000.00, 500.00, 13500.00, 'Graduate out-of-state spring semester 2024'),
(2024, 'Summer', 'Out_Of_State', 'Graduate_Student', 6500.00, 250.00, 6750.00, 'Graduate out-of-state summer semester 2024'),
-- Undergraduate - In-State
(2024, 'Fall', 'In_State', 'Undergraduate', 5500.00, 400.00, 5900.00, 'Undergraduate in-state fall semester 2024'),
(2024, 'Spring', 'In_State', 'Undergraduate', 5500.00, 400.00, 5900.00, 'Undergraduate in-state spring semester 2024'),
(2024, 'Summer', 'In_State', 'Undergraduate', 2750.00, 200.00, 2950.00, 'Undergraduate in-state summer semester 2024'),
-- Undergraduate - Out-of-State
(2024, 'Fall', 'Out_Of_State', 'Undergraduate', 12000.00, 400.00, 12400.00, 'Undergraduate out-of-state fall semester 2024'),
(2024, 'Spring', 'Out_Of_State', 'Undergraduate', 12000.00, 400.00, 12400.00, 'Undergraduate out-of-state spring semester 2024'),
(2024, 'Summer', 'Out_Of_State', 'Undergraduate', 6000.00, 200.00, 6200.00, 'Undergraduate out-of-state summer semester 2024'),
-- Graduate Students - International
(2024, 'Fall', 'International', 'Graduate_Student', 15000.00, 600.00, 15600.00, 'Graduate international fall semester 2024'),
(2024, 'Spring', 'International', 'Graduate_Student', 15000.00, 600.00, 15600.00, 'Graduate international spring semester 2024'),
(2024, 'Summer', 'International', 'Graduate_Student', 7500.00, 300.00, 7800.00, 'Graduate international summer semester 2024'),
-- Undergraduate - International
(2024, 'Fall', 'International', 'Undergraduate', 14000.00, 500.00, 14500.00, 'Undergraduate international fall semester 2024'),
(2024, 'Spring', 'International', 'Undergraduate', 14000.00, 500.00, 14500.00, 'Undergraduate international spring semester 2024'),
(2024, 'Summer', 'International', 'Undergraduate', 7000.00, 250.00, 7250.00, 'Undergraduate international summer semester 2024');

-- Sample Tuition Increase Projections (3% annual increase)
INSERT INTO tuition_increase_projections (base_year, projected_year, residency_status, student_type, increase_percentage, description) VALUES
-- Graduate Students - In-State
(2024, 2025, 'In_State', 'Graduate_Student', 3.00, '3% increase for graduate in-state 2025'),
(2024, 2026, 'In_State', 'Graduate_Student', 3.00, '3% increase for graduate in-state 2026'),
(2024, 2027, 'In_State', 'Graduate_Student', 3.00, '3% increase for graduate in-state 2027'),
-- Graduate Students - Out-of-State
(2024, 2025, 'Out_Of_State', 'Graduate_Student', 3.00, '3% increase for graduate out-of-state 2025'),
(2024, 2026, 'Out_Of_State', 'Graduate_Student', 3.00, '3% increase for graduate out-of-state 2026'),
(2024, 2027, 'Out_Of_State', 'Graduate_Student', 3.00, '3% increase for graduate out-of-state 2027'),
-- Undergraduate - In-State
(2024, 2025, 'In_State', 'Undergraduate', 3.00, '3% increase for undergraduate in-state 2025'),
(2024, 2026, 'In_State', 'Undergraduate', 3.00, '3% increase for undergraduate in-state 2026'),
(2024, 2027, 'In_State', 'Undergraduate', 3.00, '3% increase for undergraduate in-state 2027'),
-- Undergraduate - Out-of-State
(2024, 2025, 'Out_Of_State', 'Undergraduate', 3.00, '3% increase for undergraduate out-of-state 2025'),
(2024, 2026, 'Out_Of_State', 'Undergraduate', 3.00, '3% increase for undergraduate out-of-state 2026'),
(2024, 2027, 'Out_Of_State', 'Undergraduate', 3.00, '3% increase for undergraduate out-of-state 2027'),
-- Graduate Students - International
(2024, 2025, 'International', 'Graduate_Student', 3.00, '3% increase for graduate international 2025'),
(2024, 2026, 'International', 'Graduate_Student', 3.00, '3% increase for graduate international 2026'),
(2024, 2027, 'International', 'Graduate_Student', 3.00, '3% increase for graduate international 2027'),
-- Undergraduate - International
(2024, 2025, 'International', 'Undergraduate', 3.00, '3% increase for undergraduate international 2025'),
(2024, 2026, 'International', 'Undergraduate', 3.00, '3% increase for undergraduate international 2026'),
(2024, 2027, 'International', 'Undergraduate', 3.00, '3% increase for undergraduate international 2027');

-- Sample Domestic Travel Profiles
INSERT INTO travel_profiles_domestic (location_name, state, city, per_diem_rate, lodging_cap_per_night, airfare_estimate, ground_transportation_estimate, effective_year, description) VALUES
('Washington, DC', 'DC', 'Washington', 151.00, 200.00, 400.00, 50.00, 2024, 'GSA per diem rates for Washington DC'),
('New York, NY', 'NY', 'New York', 183.00, 250.00, 500.00, 75.00, 2024, 'GSA per diem rates for New York City'),
('San Francisco, CA', 'CA', 'San Francisco', 202.00, 275.00, 600.00, 60.00, 2024, 'GSA per diem rates for San Francisco'),
('Chicago, IL', 'IL', 'Chicago', 166.00, 220.00, 350.00, 45.00, 2024, 'GSA per diem rates for Chicago'),
('Boston, MA', 'MA', 'Boston', 183.00, 240.00, 450.00, 55.00, 2024, 'GSA per diem rates for Boston');

-- Sample International Travel Profiles
INSERT INTO travel_profiles_international (country, city, per_diem_rate, lodging_cap_per_night, airfare_estimate, ground_transportation_estimate, visa_fees, currency_code, exchange_rate, effective_year, description) VALUES
('United Kingdom', 'London', 250.00, 300.00, 1200.00, 80.00, 0.00, 'GBP', 1.2500, 2024, 'US State Department rates for London, UK'),
('Germany', 'Berlin', 220.00, 280.00, 1100.00, 70.00, 0.00, 'EUR', 1.1000, 2024, 'US State Department rates for Berlin, Germany'),
('Japan', 'Tokyo', 280.00, 350.00, 1400.00, 100.00, 0.00, 'JPY', 0.0067, 2024, 'US State Department rates for Tokyo, Japan'),
('Canada', 'Toronto', 180.00, 220.00, 500.00, 50.00, 0.00, 'CAD', 0.7500, 2024, 'US State Department rates for Toronto, Canada'),
('Australia', 'Sydney', 260.00, 320.00, 1500.00, 90.00, 0.00, 'AUD', 0.6500, 2024, 'US State Department rates for Sydney, Australia');

-- Federal Cost Categories (based on OMB Uniform Guidance)
INSERT INTO federal_cost_categories (category_code, category_name, description, agency, is_allowable, requires_prior_approval, restrictions) VALUES
('SALARY', 'Salaries and Wages', 'Compensation for personnel working on the grant', 'NSF', TRUE, FALSE, 'Must be reasonable and allocable to the project'),
('FRINGE', 'Fringe Benefits', 'Employee benefits such as health insurance, retirement', 'NSF', TRUE, FALSE, 'Must use institutional negotiated rates'),
('EQUIPMENT', 'Equipment', 'Tangible property with useful life > 1 year and cost > $5,000', 'NSF', TRUE, TRUE, 'Requires prior approval if > $25,000'),
('TRAVEL', 'Travel', 'Domestic and international travel expenses', 'NSF', TRUE, TRUE, 'International travel requires prior approval'),
('SUPPLIES', 'Supplies', 'Materials and supplies directly related to the project', 'NSF', TRUE, FALSE, 'Must be necessary for project execution'),
('TUITION', 'Tuition Remission', 'Graduate student tuition and fees', 'NSF', TRUE, FALSE, 'Only for graduate students on the project'),
('PARTICIPANT', 'Participant Support', 'Stipends and allowances for participants (NSF only)', 'NSF', TRUE, FALSE, 'NSF-specific category, not allowed for other agencies'),
('SUBAWARD', 'Subawards/Subcontracts', 'Funds provided to subrecipients', 'NSF', TRUE, TRUE, 'Requires subaward agreement and prior approval'),
('OTHER', 'Other Direct Costs', 'Other allowable direct costs', 'NSF', TRUE, FALSE, 'Must be reasonable, allocable, and necessary'),
('ALCOHOL', 'Alcoholic Beverages', 'Alcoholic beverages for events', 'NSF', FALSE, FALSE, 'Unallowable under federal grants'),
('ENTERTAINMENT', 'Entertainment Costs', 'Entertainment, amusement, and social activities', 'NSF', FALSE, FALSE, 'Unallowable under federal grants');

-- University Policy Constraints
INSERT INTO university_policies (policy_name, policy_type, cost_category, threshold_amount, requires_approval, approval_level, description) VALUES
('Equipment Purchase Threshold', 'Spending_Threshold', 'EQUIPMENT', 5000.00, TRUE, 'Department', 'Equipment purchases over $5,000 require department approval'),
('High-Value Equipment', 'Spending_Threshold', 'EQUIPMENT', 25000.00, TRUE, 'Dean', 'Equipment purchases over $25,000 require Dean approval'),
('International Travel', 'Prior_Approval', 'TRAVEL', 0.00, TRUE, 'Department', 'All international travel requires prior approval'),
('Domestic Travel Threshold', 'Spending_Threshold', 'TRAVEL', 2000.00, TRUE, 'PI', 'Domestic travel over $2,000 requires PI approval'),
('Subaward Threshold', 'Spending_Threshold', 'SUBAWARD', 10000.00, TRUE, 'VPR', 'Subawards over $10,000 require VPR approval'),
('Procurement Policy', 'Procurement', 'OTHER', 5000.00, TRUE, 'Department', 'Purchases over $5,000 must go through procurement office'),
('Time Restriction - Year End', 'Time_Restriction', NULL, 0.00, FALSE, 'PI', 'No new commitments in last 30 days of award period');

-- Sample Students Data
INSERT INTO students (student_number, first_name, last_name, email, student_type, residency_status, program, enrollment_status, start_date, expected_graduation_date, is_active) VALUES
-- Graduate Students
('GRAD001', 'Alexandra', 'Martinez', 'amartinez@university.edu', 'Graduate_Student', 'In_State', 'Computer Science', 'Full_Time', '2023-08-15', '2026-05-15', TRUE),
('GRAD002', 'Benjamin', 'Garcia', 'bgarcia@university.edu', 'Graduate_Student', 'Out_Of_State', 'Electrical Engineering', 'Full_Time', '2023-08-15', '2026-05-15', TRUE),
('GRAD003', 'Charlotte', 'Rodriguez', 'crodriguez@university.edu', 'Graduate_Student', 'In_State', 'Mechanical Engineering', 'Full_Time', '2024-01-10', '2027-05-15', TRUE),
('GRAD004', 'Daniel', 'Lewis', 'dlewis@university.edu', 'Graduate_Student', 'Out_Of_State', 'Biomedical Engineering', 'Full_Time', '2023-08-15', '2026-05-15', TRUE),
('GRAD005', 'Emma', 'Walker', 'ewalker@university.edu', 'Graduate_Student', 'In_State', 'Materials Science', 'Full_Time', '2024-01-10', '2027-05-15', TRUE),
('GRAD006', 'Frank', 'Hall', 'fhall@university.edu', 'Graduate_Student', 'International', 'Chemical Engineering', 'Full_Time', '2023-08-15', '2026-05-15', TRUE),
('GRAD007', 'Grace', 'Allen', 'gallen@university.edu', 'Graduate_Student', 'In_State', 'Civil Engineering', 'Full_Time', '2024-01-10', '2027-05-15', TRUE),
('GRAD008', 'Henry', 'Young', 'hyoung@university.edu', 'Graduate_Student', 'Out_Of_State', 'Aerospace Engineering', 'Full_Time', '2023-08-15', '2026-05-15', TRUE),
('GRAD009', 'Isabella', 'King', 'iking@university.edu', 'Graduate_Student', 'In_State', 'Environmental Engineering', 'Full_Time', '2024-01-10', '2027-05-15', TRUE),
('GRAD010', 'Jacob', 'Wright', 'jwright@university.edu', 'Graduate_Student', 'International', 'Industrial Engineering', 'Full_Time', '2023-08-15', '2026-05-15', TRUE),
-- Undergraduate Students
('UGRAD001', 'Olivia', 'Lopez', 'olopez@university.edu', 'Undergraduate', 'In_State', 'Computer Science', 'Full_Time', '2022-08-20', '2026-05-15', TRUE),
('UGRAD002', 'Noah', 'Hill', 'nhill@university.edu', 'Undergraduate', 'Out_Of_State', 'Electrical Engineering', 'Full_Time', '2022-08-20', '2026-05-15', TRUE),
('UGRAD003', 'Sophia', 'Scott', 'sscott@university.edu', 'Undergraduate', 'In_State', 'Mechanical Engineering', 'Full_Time', '2023-08-20', '2027-05-15', TRUE),
('UGRAD004', 'Liam', 'Green', 'lgreen@university.edu', 'Undergraduate', 'Out_Of_State', 'Biomedical Engineering', 'Full_Time', '2022-08-20', '2026-05-15', TRUE),
('UGRAD005', 'Ava', 'Adams', 'aadams@university.edu', 'Undergraduate', 'In_State', 'Materials Science', 'Full_Time', '2023-08-20', '2027-05-15', TRUE),
('UGRAD006', 'Mason', 'Baker', 'mbaker@university.edu', 'Undergraduate', 'International', 'Chemical Engineering', 'Full_Time', '2022-08-20', '2026-05-15', TRUE),
('UGRAD007', 'Mia', 'Nelson', 'mnelson@university.edu', 'Undergraduate', 'In_State', 'Civil Engineering', 'Full_Time', '2023-08-20', '2027-05-15', TRUE),
('UGRAD008', 'Ethan', 'Carter', 'ecarter@university.edu', 'Undergraduate', 'Out_Of_State', 'Aerospace Engineering', 'Full_Time', '2022-08-20', '2026-05-15', TRUE),
('UGRAD009', 'Harper', 'Mitchell', 'hmitchell@university.edu', 'Undergraduate', 'In_State', 'Environmental Engineering', 'Full_Time', '2023-08-20', '2027-05-15', TRUE),
('UGRAD010', 'Lucas', 'Perez', 'lperez@university.edu', 'Undergraduate', 'International', 'Industrial Engineering', 'Full_Time', '2022-08-20', '2026-05-15', TRUE);