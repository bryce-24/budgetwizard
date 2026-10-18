import json
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'XxbudgetwizardxX'), 
    'database': os.getenv('DB_NAME', 'budgetwizard'),
    'charset': 'utf8mb4'
}

def get_db_connection():
    return pymysql.connect(**DB_CONFIG)

def execute_query(query, params=None, fetch=True):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute(query, params)
        if fetch:
            result = cursor.fetchall()
        else:
            conn.commit()
            result = cursor.lastrowid if hasattr(cursor, 'lastrowid') else True
        return result
    except Exception as e:
        print("ERROR in execute_query:")
        print("Query: " + str(query))
        print("Params: " + str(params))
        print("Error: " + str(e))
        traceback.print_exc()
        raise
    finally:
        conn.close()

# Routes
@app.route('/api/users', methods=['GET', 'POST'])
def get_users():
    if request.method == 'GET':
        users = execute_query("SELECT * FROM users")
        return jsonify(users)
    elif request.method == 'POST':
        data = request.json
        try:
            user_id = execute_query("""
                INSERT INTO users (username, email, first_name, last_name, role, institution_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                data.get('username'),
                data.get('email'),
                data.get('first_name'),
                data.get('last_name'),
                data.get('role'),
                data.get('institution_id') if data.get('institution_id') else None
            ), fetch=False)
            return jsonify({'success': True, 'user_id': user_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/institutions', methods=['GET', 'POST'])
def get_institutions():
    if request.method == 'GET':
        institutions = execute_query("SELECT * FROM institutions")
        return jsonify(institutions)
    elif request.method == 'POST':
        data = request.json
        try:
            institution_id = execute_query("""
                INSERT INTO institutions (name, fa_rate)
                VALUES (%s, %s)
            """, (
                data.get('name'),
                data.get('fa_rate', 50.00)
            ), fetch=False)
            return jsonify({'success': True, 'institution_id': institution_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/proposals', methods=['GET', 'POST'])
def proposals():
    if request.method == 'GET':
        proposals_data = execute_query("""
            SELECT p.*, u.first_name, u.last_name, b.budget_id
            FROM proposals p 
            JOIN users u ON p.pi_id = u.user_id
            LEFT JOIN budgets b ON p.proposal_id = b.proposal_id
        """)
        return jsonify(proposals_data)
    
    elif request.method == 'POST':
        data = request.json
        # Handle new structure without pi_id requirement
        pi_id = data.get('pi_id')
        
        # If no pi_id provided, get the first available PI user as default
        if not pi_id:
            pi_users = execute_query("SELECT user_id FROM users WHERE role = 'PI' LIMIT 1")
            if pi_users:
                pi_id = pi_users[0]['user_id']
            else:
                return jsonify({'error': 'No PI users found in database. Please create a PI user first.'}), 400

        co_pi_ids_json = None
        if 'co_pi_ids' in data and data['co_pi_ids']:
            co_pi_ids_json = json.dumps(data['co_pi_ids'])

        budget_data_json = None
        budget_totals_json = None
        if 'budget_data' in data:
            budget_data_json = json.dumps(data['budget_data'])
        if 'budget_totals' in data:
            budget_totals_json = json.dumps(data['budget_totals'])
        
        try:
            proposal_id = execute_query("""
                INSERT INTO proposals (title, pi_id, co_pi_ids, agency, total_duration_years)
                VALUES (%s, %s, %s, %s, %s)
            """, (data.get('title', ''), pi_id, co_pi_ids_json, data.get('agency'), data.get('total_duration_years', 1)), fetch=False)
        except Exception as e:
            return jsonify({'error': f'Database error: {str(e)}'}), 500

        if budget_data_json:
            budget_id = execute_query("INSERT INTO budgets (proposal_id, budget_data) VALUES (%s, %s)", (proposal_id, budget_data_json), fetch=False)
        else:
            budget_id = execute_query("INSERT INTO budgets (proposal_id) VALUES (%s)", (proposal_id,), fetch=False)
        
        # Add personnel to grant_personnel table and create individual approved budget lines
        if 'budget_data' in data and data['budget_data']:
            budget_data = data['budget_data']
            
            # Add PI to grant personnel and create individual budget line
            if budget_data.get('personnel') and budget_data['personnel'].get('pi'):
                pi_data = budget_data['personnel']['pi']
                if pi_data.get('name'):
                    try:
                        # Get effort percentage (default 100%)
                        pi_effort = float(pi_data.get('effort_percentage', 100) or 100)
                        
                        # Calculate PI total (apply effort percentage)
                        pi_base_total = sum([
                            float(pi_data.get('y1', 0) or 0),
                            float(pi_data.get('y2', 0) or 0),
                            float(pi_data.get('y3', 0) or 0),
                            float(pi_data.get('y4', 0) or 0),
                            float(pi_data.get('y5', 0) or 0)
                        ])
                        pi_total = pi_base_total * (pi_effort / 100.0)
                        
                        # Add PI to grant personnel
                        execute_query("""
                            INSERT INTO grant_personnel (proposal_id, user_id, role, effort_percentage, is_active, notes)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            proposal_id,
                            pi_id,
                            'PI',
                            pi_effort,
                            True,
                            pi_data.get('notes', '')
                        ), fetch=False)
                        
                        # Create individual approved budget line for PI
                        if pi_total > 0:
                            execute_query("""
                                INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (
                                budget_id,
                                'SALARY',
                                pi_total,
                                1,
                                f'PI: {pi_data.get("name", "Principal Investigator")}'
                            ), fetch=False)
                    except Exception as e:
                        print(f"Error adding PI to grant personnel: {str(e)}")
            
            # Add Co-PIs to grant personnel and create individual budget lines
            if budget_data.get('personnel') and budget_data['personnel'].get('co_pis'):
                for idx, co_pi_data in enumerate(budget_data['personnel']['co_pis']):
                    if co_pi_data.get('name'):
                        try:
                            # Get effort percentage (default 100%)
                            co_pi_effort = float(co_pi_data.get('effort_percentage', 100) or 100)
                            
                            # Calculate Co-PI total (apply effort percentage)
                            co_pi_base_total = sum([
                                float(co_pi_data.get('y1', 0) or 0),
                                float(co_pi_data.get('y2', 0) or 0),
                                float(co_pi_data.get('y3', 0) or 0),
                                float(co_pi_data.get('y4', 0) or 0),
                                float(co_pi_data.get('y5', 0) or 0)
                            ])
                            co_pi_total = co_pi_base_total * (co_pi_effort / 100.0)
                            
                            # Try to find user by name
                            name_parts = co_pi_data['name'].split(' ', 1)
                            co_pi_user_id = None
                            if len(name_parts) == 2:
                                user_match = execute_query("""
                                    SELECT user_id FROM users 
                                    WHERE first_name = %s AND last_name = %s
                                    LIMIT 1
                                """, (name_parts[0], name_parts[1]))
                                
                                if user_match and len(user_match) > 0:
                                    co_pi_user_id = user_match[0]['user_id']
                            
                            # If no user found, use a placeholder (we'll need to handle this better)
                            # For now, we'll still create the personnel entry if we can find a Co-PI user
                            if co_pi_user_id:
                                execute_query("""
                                    INSERT INTO grant_personnel (proposal_id, user_id, role, effort_percentage, is_active, notes)
                                    VALUES (%s, %s, %s, %s, %s, %s)
                                """, (
                                    proposal_id,
                                    co_pi_user_id,
                                    'Co-PI',
                                    co_pi_effort,
                                    True,
                                    co_pi_data.get('notes', '')
                                ), fetch=False)
                            
                            # Create individual approved budget line for each Co-PI
                            if co_pi_total > 0:
                                execute_query("""
                                    INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                                    VALUES (%s, %s, %s, %s, %s)
                                """, (
                                    budget_id,
                                    'SALARY',
                                    co_pi_total,
                                    1,
                                    'Co-PI ' + str(idx + 1) + ': ' + str(co_pi_data.get("name", "Co-Principal Investigator " + str(idx + 1)))
                                ), fetch=False)
                        except Exception as e:
                            print(f"Error adding Co-PI {idx + 1} to grant personnel: {str(e)}")
            
            # Add additional faculty members to grant personnel and create individual budget lines
            if budget_data.get('personnel') and budget_data['personnel'].get('faculty'):
                for idx, faculty_data in enumerate(budget_data['personnel']['faculty']):
                    if faculty_data.get('name'):
                        try:
                            # Calculate faculty total
                            faculty_total = sum([
                                float(faculty_data.get('y1', 0) or 0),
                                float(faculty_data.get('y2', 0) or 0),
                                float(faculty_data.get('y3', 0) or 0),
                                float(faculty_data.get('y4', 0) or 0),
                                float(faculty_data.get('y5', 0) or 0)
                            ])
                            
                            # Try to find user by name
                            name_parts = faculty_data['name'].split(' ', 1)
                            faculty_user_id = None
                            if len(name_parts) == 2:
                                user_match = execute_query("""
                                    SELECT user_id FROM users 
                                    WHERE first_name = %s AND last_name = %s
                                    LIMIT 1
                                """, (name_parts[0], name_parts[1]))
                                
                                if user_match and len(user_match) > 0:
                                    faculty_user_id = user_match[0]['user_id']
                            
                            # Get effort percentage (default 100%)
                            faculty_effort = float(faculty_data.get('effort_percentage', 100) or 100)
                            
                            # Add to grant personnel if user found
                            if faculty_user_id:
                                execute_query("""
                                    INSERT INTO grant_personnel (proposal_id, user_id, role, effort_percentage, is_active, notes)
                                    VALUES (%s, %s, %s, %s, %s, %s)
                                """, (
                                    proposal_id,
                                    faculty_user_id,
                                    'Senior_Personnel',
                                    faculty_effort,
                                    True,
                                    faculty_data.get('notes', '')
                                ), fetch=False)
                            
                            # Create individual approved budget line for each faculty member
                            if faculty_total > 0:
                                execute_query("""
                                    INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                                    VALUES (%s, %s, %s, %s, %s)
                                """, (
                                    budget_id,
                                    'SALARY',
                                    faculty_total,
                                    1,
                                    'Faculty ' + str(idx + 1) + ': ' + str(faculty_data.get("name", "Faculty Member " + str(idx + 1)))
                                ), fetch=False)
                        except Exception as e:
                            print(f"Error adding faculty {idx + 1} to grant personnel: {str(e)}")

        if 'budget_totals' in data and data['budget_totals']:
            budget_totals = data['budget_totals']
            
            # Update budget total amount
            total_amount = budget_totals.get('total', 0)
            if total_amount:
                try:
                    execute_query("""
                        UPDATE budgets SET total_amount = %s WHERE budget_id = %s
                    """, (float(total_amount), budget_id), fetch=False)
                except Exception as e:
                    print(f"Error updating budget total: {str(e)}")
            
            # Map proposal budget categories to federal cost categories
            
            category_mapping = {
                'fringe': 'FRINGE',
                'equipment': 'EQUIPMENT',
                'travel': 'TRAVEL',
                'participant_support': 'PARTICIPANT',
                'other_direct': 'OTHER',
                'subawards': 'SUBAWARD'
            }
            
            # Create approved budget lines for each category (excluding personnel which is handled individually)
            for category_key, cost_category in category_mapping.items():
                amount = budget_totals.get(category_key, 0)
                if amount and float(amount) > 0:
                    try:
                        execute_query("""
                            INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            budget_id,
                            cost_category,
                            float(amount),
                            1,  # Default to year 1, can be expanded later
                            f'Approved from proposal budget - {category_key}'
                        ), fetch=False)
                    except Exception as e:
                        print(f"Error creating approved budget line for {category_key}: {str(e)}")
        
        response_data = {
            'proposal_id': proposal_id, 
            'budget_id': budget_id,
            'title': data.get('title', ''),
            'agency': data.get('agency', '')
        }
        
        if budget_totals_json:
            response_data['budget_totals'] = data.get('budget_totals')
        
        return jsonify(response_data)

@app.route('/api/proposals/<int:proposal_id>', methods=['GET', 'DELETE'])
def proposal_detail(proposal_id):
    if request.method == 'DELETE':
        try:
            # Get budget_id(s) associated with this proposal
            budgets = execute_query("SELECT budget_id FROM budgets WHERE proposal_id = %s", (proposal_id,))
            budget_ids = [b['budget_id'] for b in budgets] if budgets else []
            
            # Delete in order to respect foreign key constraints
            # 1. Delete transactions (references budget_id and budget_line_id)
            for budget_id in budget_ids:
                execute_query("DELETE FROM transactions WHERE budget_id = %s", (budget_id,), fetch=False)
            
            # 2. Delete approved_budget_lines (references budget_id)
            for budget_id in budget_ids:
                try:
                    execute_query("DELETE FROM approved_budget_lines WHERE budget_id = %s", (budget_id,), fetch=False)
                except Exception as e:
                    print(f"Error deleting approved_budget_lines: {str(e)}")
            
            # 3. Delete budget_items (references budget_id)
            for budget_id in budget_ids:
                execute_query("DELETE FROM budget_items WHERE budget_id = %s", (budget_id,), fetch=False)
            
            # 4. Delete subaward_management (references budget_id)
            for budget_id in budget_ids:
                try:
                    execute_query("DELETE FROM subaward_management WHERE budget_id = %s", (budget_id,), fetch=False)
                except Exception as e:
                    print(f"Error deleting subaward_management: {str(e)}")
            
            # 5. Delete grant_personnel (references proposal_id)
            execute_query("DELETE FROM grant_personnel WHERE proposal_id = %s", (proposal_id,), fetch=False)
            
            # 6. Delete budgets (references proposal_id)
            execute_query("DELETE FROM budgets WHERE proposal_id = %s", (proposal_id,), fetch=False)
            
            # 7. Delete proposal
            execute_query("DELETE FROM proposals WHERE proposal_id = %s", (proposal_id,), fetch=False)
            
            return jsonify({'message': 'Proposal deleted successfully'}), 200
        except Exception as e:
            return jsonify({'error': f'Error deleting proposal: {str(e)}'}), 500
    
    # GET proposal details
    proposal = execute_query("""
        SELECT p.*, u.first_name, u.last_name, u.user_id as pi_id, b.budget_id, b.total_amount
        FROM proposals p 
        JOIN users u ON p.pi_id = u.user_id
        LEFT JOIN budgets b ON p.proposal_id = b.proposal_id
        WHERE p.proposal_id = %s
    """, (proposal_id,))
    
    if not proposal:
        return jsonify({'error': 'Proposal not found'}), 404
    
    proposal_data = proposal[0] if isinstance(proposal, list) else proposal

    if proposal_data.get('budget_id') and proposal_data.get('total_amount'):
        existing_lines = execute_query("""
            SELECT COUNT(*) as count FROM approved_budget_lines WHERE budget_id = %s
        """, (proposal_data['budget_id'],))
        
        if existing_lines and existing_lines[0].get('count', 0) == 0:
            # Create a default approved budget line from the total amount
            try:
                execute_query("""
                    INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    proposal_data['budget_id'],
                    'OTHER',
                    float(proposal_data['total_amount']),
                    1,
                    'Auto-initialized from budget total'
                ), fetch=False)
            except Exception as e:
                print("Error auto-initializing approved budget lines: " + str(e))
    
    return jsonify(proposal_data)

@app.route('/api/budgets/<int:budget_id>', methods=['GET', 'PUT'])
def budget(budget_id):
    if request.method == 'GET':
        # Get budget data
        budget_data = execute_query("SELECT * FROM budgets WHERE budget_id = %s", (budget_id,))
        
        if not budget_data:
            return jsonify({'error': 'Budget not found'}), 404
        
        budget_item = budget_data[0] if isinstance(budget_data, list) else budget_data
        
        if budget_item.get('budget_data'):
            try:
                budget_item['budget_data'] = json.loads(budget_item['budget_data'])
            except:
                budget_item['budget_data'] = None
        
        # Get budget items
        items = execute_query("""
            SELECT bi.*, u.first_name, u.last_name 
            FROM budget_items bi 
            LEFT JOIN users u ON bi.person_id = u.user_id
            WHERE bi.budget_id = %s
            ORDER BY bi.year, bi.item_type
        """, (budget_id,))
        
        budget_item['items'] = items
        return jsonify(budget_item)
    
    elif request.method == 'PUT':
        data = request.json
        execute_query("""
            UPDATE budgets 
            SET total_amount = %s 
            WHERE budget_id = %s
        """, (data.get('total_amount'), budget_id), fetch=False)
        return jsonify({'success': True})

@app.route('/api/budget-items', methods=['POST'])
def add_budget_item():
    data = request.json
    
    try:
        item_id = execute_query("""
            INSERT INTO budget_items (budget_id, item_type, description, amount, year, person_id, person_type, effort_percentage)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data.get('budget_id'),
            data.get('item_type'),
            data.get('description'),
            data.get('amount'),
            data.get('year'),
            data.get('person_id') if data.get('person_id') else None,
            data.get('person_type', 'Faculty'),
            data.get('effort_percentage', 100.00)
        ), fetch=False)
        
        return jsonify({'success': True, 'item_id': item_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/rates', methods=['GET'])
def get_rates():
    rates = execute_query("SELECT * FROM rates")
    return jsonify(rates)

# Students API
@app.route('/api/students', methods=['GET', 'POST'])
def students():
    if request.method == 'GET':
        student_type = request.args.get('student_type')
        residency_status = request.args.get('residency_status')
        is_active = request.args.get('is_active', 'true')
        
        query = "SELECT * FROM students WHERE is_active = %s"
        params = [is_active.lower() == 'true']
        
        if student_type:
            query += " AND student_type = %s"
            params.append(student_type)
        
        if residency_status:
            query += " AND residency_status = %s"
            params.append(residency_status)
        
        query += " ORDER BY last_name, first_name"
        students_data = execute_query(query, tuple(params))
        return jsonify(students_data)
    
    elif request.method == 'POST':
        data = request.json
        try:
            student_id = execute_query("""
                INSERT INTO students (student_number, first_name, last_name, email, student_type, 
                                     residency_status, program, enrollment_status, start_date, 
                                     expected_graduation_date, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data.get('student_number'),
                data.get('first_name'),
                data.get('last_name'),
                data.get('email'),
                data.get('student_type'),
                data.get('residency_status'),
                data.get('program'),
                data.get('enrollment_status', 'Full_Time'),
                data.get('start_date'),
                data.get('expected_graduation_date'),
                data.get('is_active', True)
            ), fetch=False)
            return jsonify({'success': True, 'student_id': student_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

# Tuition Schedules API
@app.route('/api/tuition-schedules', methods=['GET'])
def get_tuition_schedules():
    academic_year = request.args.get('academic_year')
    semester = request.args.get('semester')
    residency_status = request.args.get('residency_status')
    student_type = request.args.get('student_type')
    
    query = "SELECT * FROM tuition_schedules WHERE is_active = TRUE"
    params = []
    
    if academic_year:
        query += " AND academic_year = %s"
        params.append(academic_year)
    
    if semester:
        query += " AND semester = %s"
        params.append(semester)
    
    if residency_status:
        query += " AND residency_status = %s"
        params.append(residency_status)
    
    if student_type:
        query += " AND student_type = %s"
        params.append(student_type)
    
    query += " ORDER BY academic_year, semester, residency_status, student_type"
    schedules = execute_query(query, tuple(params) if params else None)
    return jsonify(schedules)

# Tuition Increase Projections API
@app.route('/api/tuition-projections', methods=['GET'])
def get_tuition_projections():
    base_year = request.args.get('base_year')
    projected_year = request.args.get('projected_year')
    residency_status = request.args.get('residency_status')
    student_type = request.args.get('student_type')
    
    query = "SELECT * FROM tuition_increase_projections WHERE is_active = TRUE"
    params = []
    
    if base_year:
        query += " AND base_year = %s"
        params.append(base_year)
    
    if projected_year:
        query += " AND projected_year = %s"
        params.append(projected_year)
    
    if residency_status:
        query += " AND residency_status = %s"
        params.append(residency_status)
    
    if student_type:
        query += " AND student_type = %s"
        params.append(student_type)
    
    query += " ORDER BY base_year, projected_year"
    projections = execute_query(query, tuple(params) if params else None)
    return jsonify(projections)

# Calculate Tuition for Student
@app.route('/api/calculate-tuition', methods=['POST'])
def calculate_tuition():
    data = request.json
    student_type = data.get('student_type')
    residency_status = data.get('residency_status')
    base_year = data.get('base_year', 2024)
    num_semesters = data.get('num_semesters', 2)  # Fall + Spring
    include_summer = data.get('include_summer', False)
    years = data.get('years', 1)
    
    try:
        # Get base year tuition
        base_tuition = {}
        semesters = ['Fall', 'Spring']
        if include_summer:
            semesters.append('Summer')
        
        for semester in semesters:
            schedule = execute_query("""
                SELECT * FROM tuition_schedules 
                WHERE academic_year = %s AND semester = %s 
                AND residency_status = %s AND student_type = %s AND is_active = TRUE
            """, (base_year, semester, residency_status, student_type))
            
            if schedule and len(schedule) > 0:
                base_tuition[semester] = float(schedule[0]['total_amount'])
        
        # Check if we found any tuition schedules
        if not base_tuition:
            return jsonify({
                'error': f'No tuition schedules found for {student_type} {residency_status} students in academic year {base_year}. Please ensure tuition schedules are configured in the database.',
                'success': False
            }), 404
        
        # Calculate for each year with projections
        results = []
        total_tuition = 0
        
        for year_offset in range(years):
            current_year = base_year + year_offset
            year_total = 0
            
            # Get increase percentage for this year
            if year_offset > 0:
                projection = execute_query("""
                    SELECT * FROM tuition_increase_projections 
                    WHERE base_year = %s AND projected_year = %s 
                    AND residency_status = %s AND student_type = %s AND is_active = TRUE
                """, (base_year, current_year, residency_status, student_type))
                
                increase_pct = 0
                if projection and len(projection) > 0:
                    increase_pct = float(projection[0]['increase_percentage']) / 100.0
                
                # Apply compound increase
                multiplier = (1 + increase_pct) ** year_offset
            else:
                multiplier = 1.0
            
            # Calculate semester costs
            semester_costs = {}
            for semester in semesters:
                if semester in base_tuition:
                    cost = base_tuition[semester] * multiplier
                    semester_costs[semester] = cost
                    year_total += cost
            
            results.append({
                'year': current_year,
                'year_offset': year_offset,
                'semester_costs': semester_costs,
                'year_total': year_total,
                'multiplier': multiplier
            })
            total_tuition += year_total
        
        return jsonify({
            'success': True,
            'base_year': base_year,
            'student_type': student_type,
            'residency_status': residency_status,
            'years': years,
            'yearly_breakdown': results,
            'total_tuition': total_tuition
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Travel Profiles API
@app.route('/api/travel-profiles/domestic', methods=['GET'])
def get_domestic_travel_profiles():
    location = request.args.get('location')
    state = request.args.get('state')
    effective_year = request.args.get('effective_year')
    
    query = "SELECT * FROM travel_profiles_domestic WHERE is_active = TRUE"
    params = []
    
    if location:
        query += " AND location_name LIKE %s"
        params.append('%' + location + '%')
    
    if state:
        query += " AND state = %s"
        params.append(state)
    
    if effective_year:
        query += " AND effective_year = %s"
        params.append(effective_year)
    else:
        # Get most recent year by default
        query += " AND effective_year = (SELECT MAX(effective_year) FROM travel_profiles_domestic WHERE is_active = TRUE)"
    
    query += " ORDER BY location_name"
    profiles = execute_query(query, tuple(params) if params else None)
    return jsonify(profiles)

@app.route('/api/travel-profiles/international', methods=['GET'])
def get_international_travel_profiles():
    country = request.args.get('country')
    city = request.args.get('city')
    effective_year = request.args.get('effective_year')
    
    query = "SELECT * FROM travel_profiles_international WHERE is_active = TRUE"
    params = []
    
    if country:
        query += " AND country LIKE %s"
        params.append('%' + country + '%')
    
    if city:
        query += " AND city LIKE %s"
        params.append('%' + city + '%')
    
    if effective_year:
        query += " AND effective_year = %s"
        params.append(effective_year)
    else:
        # Get most recent year by default
        query += " AND effective_year = (SELECT MAX(effective_year) FROM travel_profiles_international WHERE is_active = TRUE)"
    
    query += " ORDER BY country, city"
    profiles = execute_query(query, tuple(params) if params else None)
    return jsonify(profiles)

# Calculate Travel Estimate
@app.route('/api/calculate-travel', methods=['POST'])
def calculate_travel():
    data = request.json
    travel_type = data.get('travel_type')  # 'domestic' or 'international'
    location = data.get('location')
    num_travelers = data.get('num_travelers', 1)
    num_nights = data.get('num_nights', 1)
    include_airfare = data.get('include_airfare', True)
    include_ground = data.get('include_ground', True)
    
    try:
        if travel_type == 'domestic':
            profile = execute_query("""
                SELECT * FROM travel_profiles_domestic 
                WHERE (location_name LIKE %s OR city LIKE %s) AND is_active = TRUE
                ORDER BY effective_year DESC LIMIT 1
            """, ('%' + location + '%', '%' + location + '%'))
        else:  # international
            profile = execute_query("""
                SELECT * FROM travel_profiles_international 
                WHERE (country LIKE %s OR city LIKE %s) AND is_active = TRUE
                ORDER BY effective_year DESC LIMIT 1
            """, ('%' + location + '%', '%' + location + '%'))
        
        if not profile or len(profile) == 0:
            return jsonify({'error': 'Travel profile not found for location: ' + location}), 404
        
        profile_data = profile[0]
        
        # Calculate costs
        per_diem = float(profile_data['per_diem_rate'])
        lodging_cap = float(profile_data['lodging_cap_per_night'])
        airfare = float(profile_data.get('airfare_estimate', 0)) if include_airfare else 0
        ground = float(profile_data.get('ground_transportation_estimate', 0)) if include_ground else 0
        
        # Per traveler costs
        per_traveler_cost = (per_diem * num_nights) + (lodging_cap * num_nights) + airfare + ground
        
        # Total cost
        total_cost = per_traveler_cost * num_travelers
        
        return jsonify({
            'success': True,
            'travel_type': travel_type,
            'location': location,
            'profile': profile_data,
            'num_travelers': num_travelers,
            'num_nights': num_nights,
            'per_traveler_breakdown': {
                'per_diem': per_diem * num_nights,
                'lodging': lodging_cap * num_nights,
                'airfare': airfare,
                'ground_transportation': ground,
                'total': per_traveler_cost
            },
            'total_cost': total_cost
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/calculate-budget/<int:budget_id>', methods=['POST'])
def calculate_budget(budget_id):
    # Get budget items
    items = execute_query("SELECT * FROM budget_items WHERE budget_id = %s", (budget_id,))
    
    # Get rates
    rates_data = execute_query("SELECT * FROM rates")
    rates = {rate['rate_type']: float(rate['rate_amount']) for rate in rates_data}
    
    total_amount = 0
    calculations = []
    
    for item in items:
        amount = float(item['amount'])
        
        if item['item_type'] == 'Salary':
            # Apply effort percentage (default 100%)
            effort_pct = float(item.get('effort_percentage', 100.00)) / 100.0
            adjusted_amount = amount * effort_pct
            
            # Get fringe benefits from database rates table based on person type and year
            person_type = item.get('person_type', 'Faculty')
            item_year = item.get('year', 2024)
            
            # Get the base fringe rate from database for the year
            fringe_rates_for_year = [r for r in rates_data if r['rate_type'] == 'Fringe' and r['year'] == item_year]
            base_fringe_rate = float(fringe_rates_for_year[0]['rate_amount']) if fringe_rates_for_year else 0.50
            
            # Apply person-type specific multipliers based on university policy
            if person_type == 'Student':
                fringe_rate = base_fringe_rate * 0.06
            elif person_type == 'Faculty':
                # Faculty use the base fringe rate from database
                fringe_rate = base_fringe_rate
            elif person_type == 'Staff_Postdoc':
                fringe_rate = base_fringe_rate * 1.8 
            else:
                fringe_rate = base_fringe_rate  # Default to base rate
            
            fringe_amount = adjusted_amount * fringe_rate
            total_amount += adjusted_amount + fringe_amount
            
            # Store adjusted values in calculations
            amount = adjusted_amount
            
            calculations.append({
                'item': item,
                'base_amount': amount,
                'fringe_amount': fringe_amount,
                'total': amount + fringe_amount
            })
        
        elif item['item_type'] == 'Tuition':
            # Tuition is already the full amount
            total_amount += amount
            
            calculations.append({
                'item': item,
                'total': amount
            })
        
        else:
            total_amount += amount
            calculations.append({
                'item': item,
                'total': amount
            })
    
    # Add overhead
    fa_rate = rates.get('FA', 0.5)
    fa_amount = total_amount * fa_rate
    final_total = total_amount + fa_amount
    
    # Update budget total
    execute_query("UPDATE budgets SET total_amount = %s WHERE budget_id = %s", 
                   (final_total, budget_id), fetch=False)
    
    return jsonify({
        'calculations': calculations,
        'subtotal': total_amount,
        'fa_amount': fa_amount,
        'total': final_total
    })

# ==================== POST-AWARD MANAGEMENT ENDPOINTS ====================

# Approved Budget Lines Management
@app.route('/api/budgets/<int:budget_id>/approved-lines', methods=['GET', 'POST'])
def approved_budget_lines(budget_id):
    if request.method == 'GET':
        lines = execute_query("""
            SELECT * FROM approved_budget_lines WHERE budget_id = %s
        """, (budget_id,))
        return jsonify(lines)
    
    elif request.method == 'POST':
        data = request.json
        try:
            line_id = execute_query("""
                INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                budget_id,
                data.get('cost_category'),
                data.get('approved_amount'),
                data.get('year'),
                data.get('notes')
            ), fetch=False)
            return jsonify({'success': True, 'line_id': line_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

# Initialize approved budget lines from proposal budget totals
@app.route('/api/budgets/<int:budget_id>/initialize-approved-lines', methods=['POST'])
def initialize_approved_lines(budget_id):
    try:
        # Get the proposal and budget
        budget = execute_query("SELECT * FROM budgets WHERE budget_id = %s", (budget_id,))
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        budget_item = budget[0] if isinstance(budget, list) else budget
        
        # Get proposal to check if it has budget totals stored
        proposal = execute_query("SELECT * FROM proposals WHERE proposal_id = %s", (budget_item['proposal_id'],))
        if not proposal:
            return jsonify({'error': 'Proposal not found'}), 404
        
        # Check if approved lines already exist and have valid data
        existing_lines = execute_query("""
            SELECT COUNT(*) as count 
            FROM approved_budget_lines 
            WHERE budget_id = %s AND approved_amount > 0
        """, (budget_id,))
        
        line_count = 0
        if existing_lines:
            if isinstance(existing_lines, (list, tuple)) and len(existing_lines) > 0:
                line_count = existing_lines[0].get('count', 0) if isinstance(existing_lines[0], dict) else 0
            elif isinstance(existing_lines, dict):
                line_count = existing_lines.get('count', 0)
        
        # If lines exist with valid amounts, return success (they're already initialized)
        if line_count > 0:
            return jsonify({
                'success': True, 
                'message': 'Approved budget lines already exist for this budget',
                'existing_count': line_count
            })
        
        # Delete any existing lines with zero amounts
        execute_query("""
            DELETE FROM approved_budget_lines 
            WHERE budget_id = %s AND (approved_amount IS NULL OR approved_amount = 0)
        """, (budget_id,), fetch=False)
        
        total_amount = budget_item.get('total_amount')
        
        # If no total_amount in budget, try to calculate from budget_items
        if not total_amount or float(total_amount or 0) == 0:
            budget_items = execute_query("""
                SELECT SUM(amount) as total FROM budget_items WHERE budget_id = %s
            """, (budget_id,))
            if budget_items:
                items_result = budget_items[0] if isinstance(budget_items, (list, tuple)) else budget_items
                if items_result and items_result.get('total'):
                    total_amount = float(items_result['total'])
        
        # If budget has a total amount, create a basic approved line
        if total_amount and float(total_amount) > 0:
            execute_query("""
                INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                budget_id,
                'OTHER',
                float(total_amount),
                1,
                'Initial approved amount from budget total'
            ), fetch=False)
            return jsonify({'success': True, 'message': 'Approved budget line created from budget total'})
        else:
            return jsonify({'error': 'Budget has no total amount to create approved lines from'}), 400
            
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return jsonify({'error': error_msg}), 400

# Budget Status Reports
@app.route('/api/budgets/<int:budget_id>/budget-status', methods=['GET'])
def budget_status(budget_id):
    try:
        # Check if approved budget lines exist, if not, auto-initialize from budget total
        existing_lines = execute_query("""
            SELECT COUNT(*) as count FROM approved_budget_lines WHERE budget_id = %s
        """, (budget_id,))

        line_count = 0
        if existing_lines:
            if isinstance(existing_lines, list) and len(existing_lines) > 0:
                line_count = existing_lines[0].get('count', 0)
            elif isinstance(existing_lines, dict):
                line_count = existing_lines.get('count', 0)

        if line_count == 0:
            # Get budget to check if it has a total amount
            budget_data = execute_query("SELECT * FROM budgets WHERE budget_id = %s", (budget_id,))

            if budget_data:
                budget_item = budget_data[0] if isinstance(budget_data, list) else budget_data
                total_amount = budget_item.get('total_amount')

                # If no total_amount in budget, try to calculate from budget_items
                if not total_amount or float(total_amount or 0) == 0:
                    budget_items = execute_query("""
                        SELECT SUM(amount) as total FROM budget_items WHERE budget_id = %s
                    """, (budget_id,))
                    if budget_items:
                        items_result = budget_items[0] if isinstance(budget_items, list) else budget_items
                        if items_result and items_result.get('total'):
                            total_amount = float(items_result['total'])

                # Create a default approved budget line if there is a total amount
                if total_amount and float(total_amount) > 0:
                    try:
                        execute_query("""
                            INSERT INTO approved_budget_lines (budget_id, cost_category, approved_amount, year, notes)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            budget_id,
                            'OTHER',
                            float(total_amount),
                            1,
                            'Auto-initialized from budget total'
                        ), fetch=False)
                    except Exception as e:
                        print("ERROR: Error auto-initializing approved budget lines: " + str(e))
                        traceback.print_exc()

        # Get budget lines grouped by category
        try:
            budget_lines = execute_query("""
                SELECT
                    cost_category,
                    COALESCE(SUM(approved_amount), 0) as total_approved,
                    COALESCE(SUM(committed_amount), 0) as total_committed,
                    COALESCE(SUM(spent_amount), 0) as total_spent,
                    COALESCE(SUM(approved_amount), 0) - COALESCE(SUM(committed_amount), 0) - COALESCE(SUM(spent_amount), 0) as remaining
                FROM approved_budget_lines
                WHERE budget_id = %s
                GROUP BY cost_category
            """, (budget_id,))
        except Exception as e:
            print("ERROR in budget_lines query: " + str(e))
            traceback.print_exc()
            raise

        # Get individual faculty members (for SALARY category)
        try:
            individual_faculty = execute_query("""
                SELECT
                    line_id,
                    cost_category,
                    approved_amount,
                    committed_amount,
                    spent_amount,
                    approved_amount - COALESCE(committed_amount, 0) - COALESCE(spent_amount, 0) as remaining,
                    notes,
                    year
                FROM approved_budget_lines
                WHERE budget_id = %s
                AND cost_category = 'SALARY'
                AND (notes LIKE 'PI:%%' OR notes LIKE 'Co-PI%%' OR notes LIKE 'Faculty%%')
                ORDER BY notes
            """, (budget_id,))
        except Exception as e:
            print("ERROR in individual_faculty query: " + str(e))
            traceback.print_exc()
            raise

        # Get overall totals
        try:
            totals = execute_query("""
                SELECT
                    COALESCE(SUM(approved_amount), 0) as total_approved,
                    COALESCE(SUM(committed_amount), 0) as total_committed,
                    COALESCE(SUM(spent_amount), 0) as total_spent
                FROM approved_budget_lines
                WHERE budget_id = %s
            """, (budget_id,))
        except Exception as e:
            print("ERROR in totals query: " + str(e))
            traceback.print_exc()
            raise

        # return lists
        budget_lines_list = list(budget_lines) if budget_lines else []
        individual_faculty_list = list(individual_faculty) if individual_faculty else []

        totals_dict = totals[0] if totals and len(totals) > 0 else {'total_approved': 0, 'total_committed': 0, 'total_spent': 0}

        return jsonify({
            'by_category': budget_lines_list,
            'individual_faculty': individual_faculty_list,
            'totals': totals_dict
        })
    except Exception as e:
        error_msg = str(e)
        print("ERROR in budget_status: " + str(error_msg))
        traceback.print_exc()
        return jsonify({
            'by_category': [],
            'individual_faculty': [],
            'totals': {'total_approved': 0, 'total_committed': 0, 'total_spent': 0},
            'error': error_msg
        })

# Transactions (Expenditure Requests)
@app.route('/api/transactions', methods=['GET', 'POST'])
def transactions():
    if request.method == 'GET':
        budget_id = request.args.get('budget_id')
        proposal_id = request.args.get('proposal_id')
        status = request.args.get('status')
        
        try:
            query = """
                SELECT t.*, u1.first_name as requester_first, u1.last_name as requester_last,
                       u2.first_name as approver_first, u2.last_name as approver_last,
                       p.title as proposal_title, p.agency
                FROM transactions t
                JOIN users u1 ON t.requested_by = u1.user_id
                LEFT JOIN users u2 ON t.approved_by = u2.user_id
                LEFT JOIN budgets b ON t.budget_id = b.budget_id
                LEFT JOIN proposals p ON b.proposal_id = p.proposal_id
                WHERE 1=1
            """
            params = []
            
            if budget_id:
                query += " AND t.budget_id = %s"
                params.append(budget_id)
            elif proposal_id:
                query += " AND b.proposal_id = %s"
                params.append(proposal_id)
            if status:
                query += " AND t.status = %s"
                params.append(status)
            
            query += " ORDER BY t.created_at DESC"
            
            transactions_data = execute_query(query, tuple(params) if params else None)
            return jsonify(transactions_data)
        except Exception as e:
            # If there's an error (table doesn't exist, etc.), return empty list
            return jsonify([])
    
    elif request.method == 'POST':
        data = request.json
        try:
            # Validate transaction
            validation_result = validate_transaction(data)
            
            if not validation_result['valid']:
                # Store transaction with validation errors
                transaction_id = execute_query("""
                    INSERT INTO transactions (budget_id, requested_by, cost_category, budget_line_id, amount, description, vendor, transaction_date, status, validation_errors)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    data.get('budget_id'),
                    data.get('requested_by'),
                    data.get('cost_category'),
                    data.get('budget_line_id'),
                    data.get('amount'),
                    data.get('description'),
                    data.get('vendor'),
                    data.get('transaction_date'),
                    'Pending',
                    str(validation_result['errors'])
                ), fetch=False)
                
                return jsonify({
                    'success': False,
                    'transaction_id': transaction_id,
                    'validation_errors': validation_result['errors'],
                    'message': 'Transaction request created but has validation errors'
                }), 400
            
            # Transaction is valid, create it
            transaction_id = execute_query("""
                INSERT INTO transactions (budget_id, requested_by, cost_category, budget_line_id, amount, description, vendor, transaction_date, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data.get('budget_id'),
                data.get('requested_by'),
                data.get('cost_category'),
                data.get('budget_line_id'),
                data.get('amount'),
                data.get('description'),
                data.get('vendor'),
                data.get('transaction_date'),
                'Pending'
            ), fetch=False)
            
            return jsonify({'success': True, 'transaction_id': transaction_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

@app.route('/api/transactions/<int:transaction_id>', methods=['GET', 'PUT'])
def transaction_detail(transaction_id):
    if request.method == 'GET':
        transaction = execute_query("""
            SELECT t.*, u1.first_name as requester_first, u1.last_name as requester_last,
                   u2.first_name as approver_first, u2.last_name as approver_last,
                   p.title as proposal_title, p.agency, abl.cost_category
            FROM transactions t
            JOIN users u1 ON t.requested_by = u1.user_id
            LEFT JOIN users u2 ON t.approved_by = u2.user_id
            LEFT JOIN budgets b ON t.budget_id = b.budget_id
            LEFT JOIN proposals p ON b.proposal_id = p.proposal_id
            LEFT JOIN approved_budget_lines abl ON t.budget_line_id = abl.line_id
            WHERE t.transaction_id = %s
        """, (transaction_id,))
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        return jsonify(transaction[0] if isinstance(transaction, list) else transaction)
    
    elif request.method == 'PUT':
        data = request.json
        status = data.get('status')
        approved_by = data.get('approved_by')
        
        if status == 'Approved':
            # Update committed amount in budget line
            transaction = execute_query("""
                SELECT t.budget_line_id, t.amount, t.budget_id, t.cost_category 
                FROM transactions t 
                WHERE t.transaction_id = %s
            """, (transaction_id,))
            
            if transaction:
                trans = transaction[0] if isinstance(transaction, list) else transaction
                budget_line_id = trans.get('budget_line_id')
                
                # If no budget_line_id, try to find a matching budget line by cost_category
                if not budget_line_id and trans.get('budget_id') and trans.get('cost_category'):
                    matching_line = execute_query("""
                        SELECT line_id FROM approved_budget_lines 
                        WHERE budget_id = %s AND cost_category = %s 
                        LIMIT 1
                    """, (trans['budget_id'], trans['cost_category']))
                    
                    if matching_line:
                        budget_line_id = matching_line[0]['line_id'] if isinstance(matching_line, list) else matching_line.get('line_id')
                        # Update the transaction with the found budget_line_id
                        if budget_line_id:
                            execute_query("""
                                UPDATE transactions SET budget_line_id = %s WHERE transaction_id = %s
                            """, (budget_line_id, transaction_id), fetch=False)
                
                # Update committed amount if there is a budget_line_id
                if budget_line_id:
                    execute_query("""
                        UPDATE approved_budget_lines
                        SET committed_amount = committed_amount + %s
                        WHERE line_id = %s
                    """, (float(trans['amount']), budget_line_id), fetch=False)
        
        execute_query("""
            UPDATE transactions
            SET status = %s, approved_by = %s, approved_at = NOW(), rejection_reason = %s
            WHERE transaction_id = %s
        """, (status, approved_by if status == 'Approved' else None, data.get('rejection_reason'), transaction_id), fetch=False)
        
        return jsonify({'success': True})

# Validation Engine
def validate_transaction(data):
    errors = []
    budget_id = data.get('budget_id')
    cost_category = data.get('cost_category')
    
    # Validate amount
    amount_str = data.get('amount')
    if amount_str is None or amount_str == '':
        errors.append("Amount is required")
        return {'valid': False, 'errors': errors}
    
    try:
        amount = float(amount_str)
        if amount <= 0:
            errors.append("Amount must be greater than zero")
            return {'valid': False, 'errors': errors}
    except (ValueError, TypeError):
        errors.append("Invalid amount specified")
        return {'valid': False, 'errors': errors}
    
    # Check if cost category is allowable
    if not cost_category:
        errors.append("Cost category is required")
        return {'valid': False, 'errors': errors}
    
    category = execute_query("""
        SELECT * FROM federal_cost_categories WHERE category_code = %s
    """, (cost_category,))
    
    if not category or len(category) == 0:
        errors.append("Cost category " + str(cost_category) + " not found")
    else:
        cat = category[0] if isinstance(category, list) else category
        if not cat.get('is_allowable'):
            errors.append("Cost category " + str(cost_category) + " is not allowable under federal regulations")
        
        if cat.get('requires_prior_approval'):
            errors.append("Cost category " + str(cost_category) + " requires prior approval")
    
    # Check budget availability
    if budget_id:
        available = execute_query("""
            SELECT 
                COALESCE(SUM(approved_amount), 0) - COALESCE(SUM(committed_amount), 0) - COALESCE(SUM(spent_amount), 0) as available
            FROM approved_budget_lines
            WHERE budget_id = %s AND cost_category = %s
        """, (budget_id, cost_category))
        
        if available:
            avail = available[0] if isinstance(available, list) else available
            available_amount = avail.get('available')
            if available_amount is None:
                available_amount = 0
            else:
                try:
                    available_amount = float(available_amount)
                except (ValueError, TypeError):
                    available_amount = 0
            
            if available_amount < amount:
                # Format numbers to 2 decimal places
                if isinstance(available_amount, (int, float)):
                    avail_str = str(round(available_amount, 2))
                else:
                    avail_str = str(available_amount)
                if isinstance(amount, (int, float)):
                    amount_str = str(round(amount, 2))
                else:
                    amount_str = str(amount)
                errors.append("Insufficient funds. Available: $" + avail_str + ", Requested: $" + amount_str)
    
    # Check university policies
    policies = execute_query("""
        SELECT * FROM university_policies
        WHERE (cost_category = %s OR cost_category IS NULL)
        AND is_active = TRUE
        AND (
            (policy_type = 'Spending_Threshold' AND threshold_amount <= %s)
            OR (policy_type = 'Prior_Approval')
            OR (policy_type = 'Time_Restriction' AND CURDATE() BETWEEN time_restriction_start AND time_restriction_end)
        )
    """, (cost_category, amount))
    
    for policy in policies:
        if policy.get('requires_approval'):
            errors.append("Policy violation: " + str(policy.get('policy_name')) + " - Requires " + str(policy.get('approval_level')) + " approval")
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }

# Federal Cost Categories
@app.route('/api/federal-cost-categories', methods=['GET'])
def get_federal_cost_categories():
    categories = execute_query("SELECT * FROM federal_cost_categories ORDER BY category_name")
    return jsonify(categories)

# University Policies
@app.route('/api/university-policies', methods=['GET'])
def get_university_policies():
    policies = execute_query("SELECT * FROM university_policies WHERE is_active = TRUE ORDER BY policy_name")
    return jsonify(policies)

# Grant Personnel
@app.route('/api/proposals/<int:proposal_id>/personnel', methods=['GET', 'POST'])
def grant_personnel(proposal_id):
    if request.method == 'GET':
        personnel = execute_query("""
            SELECT gp.*, u.first_name, u.last_name, u.email, u.role
            FROM grant_personnel gp
            JOIN users u ON gp.user_id = u.user_id
            WHERE gp.proposal_id = %s AND gp.is_active = TRUE
        """, (proposal_id,))
        return jsonify(personnel)
    
    elif request.method == 'POST':
        data = request.json
        try:
            personnel_id = execute_query("""
                INSERT INTO grant_personnel (proposal_id, user_id, role, effort_percentage, start_date, end_date, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                proposal_id,
                data.get('user_id'),
                data.get('role'),
                data.get('effort_percentage'),
                data.get('start_date'),
                data.get('end_date'),
                data.get('is_active', True)
            ), fetch=False)
            return jsonify({'success': True, 'personnel_id': personnel_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

# Subaward Management
@app.route('/api/budgets/<int:budget_id>/subawards', methods=['GET', 'POST'])
def subaward_management(budget_id):
    if request.method == 'GET':
        subawards = execute_query("""
            SELECT sm.*, i.name as institution_name, s.description
            FROM subaward_management sm
            JOIN institutions i ON sm.subrecipient_institution_id = i.institution_id
            LEFT JOIN subawards s ON sm.subaward_id = s.subaward_id
            WHERE sm.budget_id = %s
        """, (budget_id,))
        return jsonify(subawards)
    
    elif request.method == 'POST':
        data = request.json
        try:
            subaward_mgmt_id = execute_query("""
                INSERT INTO subaward_management (subaward_id, budget_id, subaward_number, subrecipient_institution_id, total_amount, start_date, end_date, status, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data.get('subaward_id'),
                budget_id,
                data.get('subaward_number'),
                data.get('subrecipient_institution_id'),
                data.get('total_amount'),
                data.get('start_date'),
                data.get('end_date'),
                data.get('status', 'Active'),
                data.get('notes')
            ), fetch=False)
            return jsonify({'success': True, 'subaward_mgmt_id': subaward_mgmt_id})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
