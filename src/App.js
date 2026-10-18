import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import './App.css';

function App() {
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="header-container">
            <div>
          <h1>BudgetWizard</h1>
          <nav className="nav">
            <Link to="/" className="nav-link">Create Proposal</Link>
            <Link to="/proposals" className="nav-link">My Proposals</Link>
            <Link to="/transactions" className="nav-link">Transactions</Link>
                <Link to="/admin" className="nav-link">Admin</Link>
          </nav>
            </div>
            <button
              onClick={() => setShowAddEntryModal(true)}
              className="add-entry-button"
            >
              + Add Entry
            </button>
          </div>
        </header>
        <main className="App-main">
          <Routes>
            <Route path="/" element={<ProposalFlow />} />
            <Route path="/proposals" element={<ProposalsDashboard />} />
            <Route path="/proposals/:proposalId" element={<ProposalDetail />} />
            <Route path="/transactions" element={<TransactionsView />} />
            <Route path="/admin" element={<AdminTransactionsView />} />
          </Routes>
        </main>
        {showAddEntryModal && (
          <AddEntryModal 
            onClose={() => setShowAddEntryModal(false)}
            onSuccess={() => {
              setShowAddEntryModal(false);
              // Refresh the page to update dropdowns
              window.location.reload();
            }}
          />
        )}
      </div>
    </Router>
  );
}

function ProposalFlow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [proposal, setProposal] = useState(null);
  const [budget, setBudget] = useState(null);
  const [users, setUsers] = useState([]);
  const [rates, setRates] = useState([]);
  const [institutions, setInstitutions] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchRates();
    fetchInstitutions();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchRates = async () => {
    try {
      const response = await axios.get('/api/rates');
      setRates(response.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const fetchInstitutions = async () => {
    try {
      const response = await axios.get('/api/institutions');
      setInstitutions(response.data);
    } catch (error) {
      console.error('Error fetching institutions:', error);
    }
  };

  const [budgetTotals, setBudgetTotals] = useState(null);

  const createProposal = async (proposalData) => {
    try {
      const response = await axios.post('/api/proposals', proposalData);
      // Store proposal with budget data
      const proposalWithBudget = {
        ...response.data,
        budget_data: proposalData.budget_data,
        budget_totals: response.data.budget_totals || proposalData.budget_totals
      };
      setProposal(proposalWithBudget);
      // Store budget totals for visualization
      if (proposalWithBudget.budget_totals) {
        setBudgetTotals(proposalWithBudget.budget_totals);
      }
      //fetch budget
      if (response.data.budget_id) {
        await fetchBudget(response.data.budget_id);
      }
      return response.data;
    } catch (error) {
      console.error('Error creating proposal:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        const errorMessage = error.response.data?.error || error.message || 'Unknown error';
        alert(`Error creating proposal: ${errorMessage}`);
      } else if (error.request) {
        console.error('No response received:', error.request);
        alert('Error creating proposal: No response from server. Is the backend running?');
      } else {
        console.error('Error setting up request:', error.message);
        alert(`Error creating proposal: ${error.message}`);
      }
      throw error;
    }
  };

  const fetchBudget = async (budgetId) => {
    try {
      const response = await axios.get(`/api/budgets/${budgetId}`);
      setBudget(response.data);
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  };

  const addBudgetItem = async (itemData) => {
    try {
      await axios.post('/api/budget-items', itemData);
      if (budget) {
        fetchBudget(budget.budget_id);
      }
    } catch (error) {
      console.error('Error adding budget item:', error);
    }
  };

  const calculateBudget = async (budgetId) => {
    try {
      const response = await axios.post(`/api/calculate-budget/${budgetId}`);
      // Update the budget state with the calculated total
      if (budget) {
        const updatedBudget = {
          ...budget,
          total_amount: response.data.total
        };
        setBudget(updatedBudget);
      }
      return response.data;
    } catch (error) {
      console.error('Error calculating budget:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <ProposalStep onCreateProposal={createProposal} users={users} rates={rates} institutions={institutions} onNext={() => setCurrentStep(2)} />;
      case 2:
        return <BudgetStep budget={budget} budgetTotals={budgetTotals} proposal={proposal} budgetData={proposal?.budget_data} />;
      default:
        return <div>Step not found</div>;
    }
  };

  return (
    <div>
      <div className="step-indicator">
        <span className={currentStep >= 1 ? 'active' : ''}>1. Proposal</span>
        <span className={currentStep >= 2 ? 'active' : ''}>2. Budget</span>
      </div>
      {renderStep()}
    </div>
  );
}

function ProposalStep({ onCreateProposal, users, rates, institutions, onNext }) {
  const [formData, setFormData] = useState({
    title: '',
    agency: '',
    total_duration_years: 5,
    start_date: '',
    end_date: ''
  });

  const [students, setStudents] = useState([]);
  const [tuitionSchedules, setTuitionSchedules] = useState([]);
  const [domesticTravelProfiles, setDomesticTravelProfiles] = useState([]);
  const [internationalTravelProfiles, setInternationalTravelProfiles] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]); // For tuition calculations
  const [showTuitionCalculator, setShowTuitionCalculator] = useState(false);
  const [showTravelCalculator, setShowTravelCalculator] = useState(null); // null or {type: 'domestic'/'international', field: 'domestic'/'international'}

  // Filter users by role
  const piUsers = users.filter(u => u.role === 'PI');
  const coPiUsers = users.filter(u => u.role === 'Co-PI');
  const facultyUsers = users.filter(u => u.role === 'PI' || u.role === 'Co-PI'); // Faculty can be PIs or Co-PIs

  // Get rates by year and type
  const getRateByYear = (rateType, year) => {
    const rate = rates.find(r => r.rate_type === rateType && r.year === year);
    return rate ? parseFloat(rate.rate_amount) : null;
  };

  const getRateByYearFormatted = (rateType, year) => {
    const rate = getRateByYear(rateType, year);
    return rate !== null ? (rate * 100).toFixed(2) + '%' : 'N/A';
  };

  // Get base year (assuming 2024 as starting year)
  const baseYear = 2024;
  const yearRates = {
    y1: { year: baseYear, fringe: getRateByYearFormatted('Fringe', baseYear), fa: getRateByYearFormatted('FA', baseYear), fringeValue: getRateByYear('Fringe', baseYear) },
    y2: { year: baseYear + 1, fringe: getRateByYearFormatted('Fringe', baseYear + 1), fa: getRateByYearFormatted('FA', baseYear + 1), fringeValue: getRateByYear('Fringe', baseYear + 1) },
    y3: { year: baseYear + 2, fringe: getRateByYearFormatted('Fringe', baseYear + 2), fa: getRateByYearFormatted('FA', baseYear + 2), fringeValue: getRateByYear('Fringe', baseYear + 2) },
    y4: { year: baseYear + 3, fringe: getRateByYearFormatted('Fringe', baseYear + 3), fa: getRateByYearFormatted('FA', baseYear + 3), fringeValue: getRateByYear('Fringe', baseYear + 3) },
    y5: { year: baseYear + 4, fringe: getRateByYearFormatted('Fringe', baseYear + 4), fa: getRateByYearFormatted('FA', baseYear + 4), fringeValue: getRateByYear('Fringe', baseYear + 4) }
  };


  useEffect(() => {
    fetchStudents();
    fetchTuitionSchedules();
    fetchTravelProfiles();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchTuitionSchedules = async () => {
    try {
      const response = await axios.get('/api/tuition-schedules');
      setTuitionSchedules(response.data);
    } catch (error) {
      console.error('Error fetching tuition schedules:', error);
    }
  };

  const fetchTravelProfiles = async () => {
    try {
      const [domestic, international] = await Promise.all([
        axios.get('/api/travel-profiles/domestic'),
        axios.get('/api/travel-profiles/international')
      ]);
      setDomesticTravelProfiles(domestic.data);
      setInternationalTravelProfiles(international.data);
    } catch (error) {
      console.error('Error fetching travel profiles:', error);
    }
  };

  const calculateTuitionForStudent = async (studentId, years, includeSummer) => {
    try {
      const student = students.find(s => s.student_id === studentId);
      if (!student) {
        console.error('Student not found:', studentId);
        return null;
      }

      // Use 2024 as base year
      const baseYear = 2024;

      const response = await axios.post('/api/calculate-tuition', {
        student_type: student.student_type,
        residency_status: student.residency_status,
        base_year: baseYear,
        num_semesters: includeSummer ? 3 : 2,
        include_summer: includeSummer,
        years: years
      });

      return response.data;
    } catch (error) {
      console.error('Error calculating tuition:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      return null;
    }
  };

  const calculateTravelCost = async (travelType, location, numTravelers, numNights) => {
    try {
      const response = await axios.post('/api/calculate-travel', {
        travel_type: travelType,
        location: location,
        num_travelers: numTravelers,
        num_nights: numNights,
        include_airfare: true,
        include_ground: true
      });

      return response.data;
    } catch (error) {
      console.error('Error calculating travel:', error);
      return null;
    }
  };

  const [budgetData, setBudgetData] = useState({
    personnel: {
      pi: { user_id: '', name: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      co_pis: [],
      faculty: []  // Additional faculty members
    },
    other_personnel: {
      professional_staff: { student_id: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      gras_ugrads: [{ student_id: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }], // Array of student entries - start with one empty entry
      temp_help: { student_id: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
    },
    equipment: {
      over_5k: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
    },
    travel: {
      domestic: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      international: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
    },
    participant_support: {
      nsf: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
    },
    other_direct: {
      materials_supplies: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      small_equipment: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      publication: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      computer_services: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      software: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      facility_fees: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      conference_reg: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      other1: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      other2: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
      student_tuition: [{ student_id: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }] // Array of student tuition entries - start with one empty entry
    },
    subawards: []
  });

  const calculateBudgetTotals = () => {
    let totals = {
      personnel: 0,
      fringe: 0,
      equipment: 0,
      travel: 0,
      participant_support: 0,
      other_direct: 0,
      subawards: 0,
      direct_costs: 0,
      fa_overhead: 0,
      total: 0
    };

    // Calculate PI total (year values already have effort applied)
    const pi = budgetData.personnel.pi;
    totals.personnel += (parseFloat(pi.y1) || 0) + (parseFloat(pi.y2) || 0) + (parseFloat(pi.y3) || 0) + (parseFloat(pi.y4) || 0) + (parseFloat(pi.y5) || 0);

    // Calculate Co-PIs totals (year values already have effort applied)
    budgetData.personnel.co_pis.forEach(coPi => {
      totals.personnel += (parseFloat(coPi.y1) || 0) + (parseFloat(coPi.y2) || 0) + (parseFloat(coPi.y3) || 0) + (parseFloat(coPi.y4) || 0) + (parseFloat(coPi.y5) || 0);
    });

    // Calculate additional faculty totals (year values already have effort applied)
    if (budgetData.personnel.faculty) {
      budgetData.personnel.faculty.forEach(faculty => {
        totals.personnel += (parseFloat(faculty.y1) || 0) + (parseFloat(faculty.y2) || 0) + (parseFloat(faculty.y3) || 0) + (parseFloat(faculty.y4) || 0) + (parseFloat(faculty.y5) || 0);
      });
    }

    // Calculate other personnel (year values already have effort applied)
    Object.entries(budgetData.other_personnel).forEach(([key, person]) => {
      if (key === 'gras_ugrads' && Array.isArray(person)) {
        // Handle students array
        person.forEach(student => {
          totals.personnel += (parseFloat(student.y1) || 0) + (parseFloat(student.y2) || 0) + (parseFloat(student.y3) || 0) + (parseFloat(student.y4) || 0) + (parseFloat(student.y5) || 0);
        });
      } else if (typeof person === 'object' && person !== null) {
        // Handle single person objects (Professional Staff, Temp Help, Postdocs)
      totals.personnel += (parseFloat(person.y1) || 0) + (parseFloat(person.y2) || 0) + (parseFloat(person.y3) || 0) + (parseFloat(person.y4) || 0) + (parseFloat(person.y5) || 0);
      }
    });

    // Calculate fringe automatically from salaries
    // Fringe rates multipliers: Faculty = 1.0x, Professional Staff = 1.33x, Students = 0.06x, Temp Help = 0.166x
    const fringeMultipliers = {
      faculty: 1.0,
      professional_staff: 1.33,
      gras_ugrads: 0.06,
      temp_help: 0.166
    };

    // Initialize salary totals by person type and year
    const salaryByTypeAndYear = {
      faculty: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      professional_staff: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      gras_ugrads: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      temp_help: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 }
    };

    // Sum PI salaries by year (year values already have effort applied, use directly for fringe)
    const piData = budgetData.personnel.pi;
    // Fringe is calculated on effort-adjusted salary (actual salary being paid)
    salaryByTypeAndYear.faculty.y1 += (parseFloat(piData.y1) || 0);
    salaryByTypeAndYear.faculty.y2 += (parseFloat(piData.y2) || 0);
    salaryByTypeAndYear.faculty.y3 += (parseFloat(piData.y3) || 0);
    salaryByTypeAndYear.faculty.y4 += (parseFloat(piData.y4) || 0);
    salaryByTypeAndYear.faculty.y5 += (parseFloat(piData.y5) || 0);

    // Sum Co-PI salaries by year (year values already have effort applied, use directly for fringe)
    budgetData.personnel.co_pis.forEach(coPi => {
      // Fringe is calculated on effort-adjusted salary (actual salary being paid)
      salaryByTypeAndYear.faculty.y1 += (parseFloat(coPi.y1) || 0);
      salaryByTypeAndYear.faculty.y2 += (parseFloat(coPi.y2) || 0);
      salaryByTypeAndYear.faculty.y3 += (parseFloat(coPi.y3) || 0);
      salaryByTypeAndYear.faculty.y4 += (parseFloat(coPi.y4) || 0);
      salaryByTypeAndYear.faculty.y5 += (parseFloat(coPi.y5) || 0);
    });

    // Sum additional faculty salaries by year (year values already have effort applied, use directly for fringe)
    if (budgetData.personnel.faculty) {
      budgetData.personnel.faculty.forEach(faculty => {
        // Fringe is calculated on effort-adjusted salary (actual salary being paid)
        salaryByTypeAndYear.faculty.y1 += (parseFloat(faculty.y1) || 0);
        salaryByTypeAndYear.faculty.y2 += (parseFloat(faculty.y2) || 0);
        salaryByTypeAndYear.faculty.y3 += (parseFloat(faculty.y3) || 0);
        salaryByTypeAndYear.faculty.y4 += (parseFloat(faculty.y4) || 0);
        salaryByTypeAndYear.faculty.y5 += (parseFloat(faculty.y5) || 0);
      });
    }

    // Sum professional staff salaries by year (year values already have effort applied)
    const profStaff = budgetData.other_personnel.professional_staff;
    salaryByTypeAndYear.professional_staff.y1 += (parseFloat(profStaff.y1) || 0);
    salaryByTypeAndYear.professional_staff.y2 += (parseFloat(profStaff.y2) || 0);
    salaryByTypeAndYear.professional_staff.y3 += (parseFloat(profStaff.y3) || 0);
    salaryByTypeAndYear.professional_staff.y4 += (parseFloat(profStaff.y4) || 0);
    salaryByTypeAndYear.professional_staff.y5 += (parseFloat(profStaff.y5) || 0);

    // Sum student (GRAs/UGrads) salaries by year (year values already have effort applied)
    if (Array.isArray(budgetData.other_personnel.gras_ugrads)) {
      budgetData.other_personnel.gras_ugrads.forEach(student => {
        salaryByTypeAndYear.gras_ugrads.y1 += (parseFloat(student.y1) || 0);
        salaryByTypeAndYear.gras_ugrads.y2 += (parseFloat(student.y2) || 0);
        salaryByTypeAndYear.gras_ugrads.y3 += (parseFloat(student.y3) || 0);
        salaryByTypeAndYear.gras_ugrads.y4 += (parseFloat(student.y4) || 0);
        salaryByTypeAndYear.gras_ugrads.y5 += (parseFloat(student.y5) || 0);
      });
    }

    // Sum temp help salaries by year (year values already have effort applied)
    const tempHelp = budgetData.other_personnel.temp_help;
    salaryByTypeAndYear.temp_help.y1 += (parseFloat(tempHelp.y1) || 0);
    salaryByTypeAndYear.temp_help.y2 += (parseFloat(tempHelp.y2) || 0);
    salaryByTypeAndYear.temp_help.y3 += (parseFloat(tempHelp.y3) || 0);
    salaryByTypeAndYear.temp_help.y4 += (parseFloat(tempHelp.y4) || 0);
    salaryByTypeAndYear.temp_help.y5 += (parseFloat(tempHelp.y5) || 0);

    // Calculate fringe for each person type and year using year-specific rates
    const calculatedFringe = {
      faculty: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      professional_staff: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      gras_ugrads: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      temp_help: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 }
    };

    // Calculate fringe for each year and person type
    ['y1', 'y2', 'y3', 'y4', 'y5'].forEach(yearKey => {
      const yearIndex = parseInt(yearKey.substring(1)) - 1;
      const year = baseYear + yearIndex;
      const baseFringeRate = getRateByYear('Fringe', year) || 0.31; // Default to 31% if not found

      Object.keys(fringeMultipliers).forEach(personType => {
        const salary = salaryByTypeAndYear[personType][yearKey];
        const multiplier = fringeMultipliers[personType];
        const fringeRate = baseFringeRate * multiplier;
        calculatedFringe[personType][yearKey] = salary * fringeRate;
        totals.fringe += calculatedFringe[personType][yearKey];
    });
    });

    // Store calculated fringe in totals for export/display
    totals.calculatedFringe = calculatedFringe;

    // Calculate equipment
    totals.equipment += (parseFloat(budgetData.equipment.over_5k.y1) || 0) + (parseFloat(budgetData.equipment.over_5k.y2) || 0) + (parseFloat(budgetData.equipment.over_5k.y3) || 0) + (parseFloat(budgetData.equipment.over_5k.y4) || 0) + (parseFloat(budgetData.equipment.over_5k.y5) || 0);

    // Calculate travel
    totals.travel += (parseFloat(budgetData.travel.domestic.y1) || 0) + (parseFloat(budgetData.travel.domestic.y2) || 0) + (parseFloat(budgetData.travel.domestic.y3) || 0) + (parseFloat(budgetData.travel.domestic.y4) || 0) + (parseFloat(budgetData.travel.domestic.y5) || 0);
    totals.travel += (parseFloat(budgetData.travel.international.y1) || 0) + (parseFloat(budgetData.travel.international.y2) || 0) + (parseFloat(budgetData.travel.international.y3) || 0) + (parseFloat(budgetData.travel.international.y4) || 0) + (parseFloat(budgetData.travel.international.y5) || 0);

    // Calculate participant support
    totals.participant_support += (parseFloat(budgetData.participant_support.nsf.y1) || 0) + (parseFloat(budgetData.participant_support.nsf.y2) || 0) + (parseFloat(budgetData.participant_support.nsf.y3) || 0) + (parseFloat(budgetData.participant_support.nsf.y4) || 0) + (parseFloat(budgetData.participant_support.nsf.y5) || 0);

    // Calculate other direct costs
    Object.entries(budgetData.other_direct).forEach(([key, item]) => {
      if (key === 'student_tuition' && Array.isArray(item)) {
        // Handle student tuition array
        item.forEach(tuition => {
          totals.other_direct += (parseFloat(tuition.y1) || 0) + (parseFloat(tuition.y2) || 0) + (parseFloat(tuition.y3) || 0) + (parseFloat(tuition.y4) || 0) + (parseFloat(tuition.y5) || 0);
        });
      } else if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Handle single item objects
      totals.other_direct += (parseFloat(item.y1) || 0) + (parseFloat(item.y2) || 0) + (parseFloat(item.y3) || 0) + (parseFloat(item.y4) || 0) + (parseFloat(item.y5) || 0);
      }
    });

    // Calculate subawards
    budgetData.subawards.forEach(subaward => {
      totals.subawards += (parseFloat(subaward.y1) || 0) + (parseFloat(subaward.y2) || 0) + (parseFloat(subaward.y3) || 0) + (parseFloat(subaward.y4) || 0) + (parseFloat(subaward.y5) || 0);
    });

    // Total direct costs (before F&A)
    totals.direct_costs = totals.personnel + totals.fringe + totals.equipment + totals.travel + totals.participant_support + totals.other_direct + totals.subawards;
    
    // Calculate F&A (Facilities & Administrative overhead) using year-specific rates
    // F&A is 50% of total direct costs
    // Get F&A rate from database (use base year rate)
    const faRate = rates.find(r => r.rate_type === 'FA' && r.year === baseYear);
    const avgFaRate = faRate ? parseFloat(faRate.rate_amount) : 0.5; // Default to 50% if not found
    totals.fa_overhead = totals.direct_costs * avgFaRate;
    
    // Total project cost (direct costs + F&A overhead)
    totals.total = totals.direct_costs + totals.fa_overhead;

    return totals;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      alert('Please enter a proposal title');
      return;
    }
    
    try {
      const budgetTotals = calculateBudgetTotals();
      
      const proposalData = {
        title: formData.title,
        agency: formData.agency || '',
        total_duration_years: formData.total_duration_years || 5,
        start_date: formData.start_date || '',
        end_date: formData.end_date || '',
        budget_data: budgetData,
        budget_totals: budgetTotals
      };
      
      const result = await onCreateProposal(proposalData);
      if (result) {
        onNext();
      } else {
        console.error('Failed to create proposal - no result returned');
        alert('Failed to create proposal. Please check the console for details.');
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      // Error already handled in createProposal
    }
  };

  // Shared helper for personnel entries: applies the field update and, when the
  // changed field drives salary (hourly_rate, y1_hours, effort_percentage),
  // recalculates the effort-adjusted salary across all year fields (y1-y5).
  const applyEffortAdjustedSalaryUpdate = (item, field, value) => {
    const updatedItem = { ...item, [field]: value };

    if (field === 'hourly_rate' || field === 'y1_hours' || field === 'effort_percentage') {
      const hourlyRate = field === 'hourly_rate' ? value : updatedItem.hourly_rate;
      const hours = field === 'y1_hours' ? value : updatedItem.y1_hours;
      const effort = field === 'effort_percentage' ? value : updatedItem.effort_percentage;

      const rate = parseFloat(hourlyRate) || 0;
      const hoursNum = parseFloat(hours) || 0;
      const effortNum = parseFloat(effort) || 100;

      if (rate > 0 && hoursNum > 0) {
        // Calculate base salary
        const baseSalary = rate * hoursNum * 52;
        // Apply effort percentage to get the effort-adjusted salary
        const effortAdjustedSalary = (baseSalary * (effortNum / 100)).toFixed(2);
        // Update all year fields with effort-adjusted salary
        updatedItem.y1 = effortAdjustedSalary;
        updatedItem.y2 = effortAdjustedSalary;
        updatedItem.y3 = effortAdjustedSalary;
        updatedItem.y4 = effortAdjustedSalary;
        updatedItem.y5 = effortAdjustedSalary;
      }
    }

    return updatedItem;
  };

  const updateBudgetField = (category, item, field, value) => {
    setBudgetData(prev => {
      const updatedData = { ...prev };
      const categoryData = { ...prev[category] };
      const itemData = { ...prev[category][item] };

      // Auto-calculate salary for PI if hourly_rate, y1_hours, or effort_percentage changes
      if (category === 'personnel' && item === 'pi' &&
          (field === 'hourly_rate' || field === 'y1_hours' || field === 'effort_percentage')) {
        categoryData[item] = applyEffortAdjustedSalaryUpdate(itemData, field, value);
        updatedData[category] = categoryData;
        return updatedData;
      }

      // Default behavior for other fields
      categoryData[item] = {
        ...itemData,
          [field]: value
      };
      updatedData[category] = categoryData;
      return updatedData;
    });
  };

  const addCoPI = () => {
    setBudgetData(prev => ({
      ...prev,
      personnel: {
        ...prev.personnel,
        co_pis: [...prev.personnel.co_pis, { user_id: '', name: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }]
      }
    }));
  };

  const removeCoPI = (index) => {
    setBudgetData(prev => ({
      ...prev,
      personnel: {
        ...prev.personnel,
        co_pis: prev.personnel.co_pis.filter((_, i) => i !== index)
      }
    }));
  };

  const updateCoPIField = (index, field, value) => {
    setBudgetData(prev => {
      const updatedCoPIs = prev.personnel.co_pis.map((coPi, i) =>
        i === index ? applyEffortAdjustedSalaryUpdate(coPi, field, value) : coPi
      );

      return {
      ...prev,
      personnel: {
        ...prev.personnel,
          co_pis: updatedCoPIs
      }
      };
    });
  };

  const addFaculty = () => {
    setBudgetData(prev => ({
      ...prev,
      personnel: {
        ...prev.personnel,
        faculty: [...(prev.personnel.faculty || []), { user_id: '', name: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }]
      }
    }));
  };

  const removeFaculty = (index) => {
    setBudgetData(prev => ({
      ...prev,
      personnel: {
        ...prev.personnel,
        faculty: (prev.personnel.faculty || []).filter((_, i) => i !== index)
      }
    }));
  };

  const updateFacultyField = (index, field, value) => {
    setBudgetData(prev => {
      const updatedFaculty = (prev.personnel.faculty || []).map((faculty, i) =>
        i === index ? applyEffortAdjustedSalaryUpdate(faculty, field, value) : faculty
      );

      return {
      ...prev,
      personnel: {
        ...prev.personnel,
          faculty: updatedFaculty
        }
      };
    });
  };

  const addStudent = () => {
    setBudgetData(prev => ({
      ...prev,
      other_personnel: {
        ...prev.other_personnel,
        gras_ugrads: [...(prev.other_personnel.gras_ugrads || []), { student_id: '', effort_percentage: '', hourly_rate: '', y1_hours: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }]
      }
    }));
  };

  const removeStudent = (index) => {
    setBudgetData(prev => ({
      ...prev,
      other_personnel: {
        ...prev.other_personnel,
        gras_ugrads: (prev.other_personnel.gras_ugrads || []).filter((_, i) => i !== index)
      }
    }));
  };

  const updateStudentField = (index, field, value) => {
    setBudgetData(prev => {
      const updatedStudents = (prev.other_personnel.gras_ugrads || []).map((student, i) =>
        i === index ? applyEffortAdjustedSalaryUpdate(student, field, value) : student
      );

      return {
        ...prev,
        other_personnel: {
          ...prev.other_personnel,
          gras_ugrads: updatedStudents
        }
      };
    });
  };

  const addStudentTuition = () => {
    setBudgetData(prev => ({
      ...prev,
      other_direct: {
        ...prev.other_direct,
        student_tuition: [...(prev.other_direct.student_tuition || []), { student_id: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }]
      }
    }));
  };

  const removeStudentTuition = (index) => {
    setBudgetData(prev => ({
      ...prev,
      other_direct: {
        ...prev.other_direct,
        student_tuition: (prev.other_direct.student_tuition || []).filter((_, i) => i !== index)
      }
    }));
  };

  const updateStudentTuitionField = (index, field, value) => {
    setBudgetData(prev => ({
      ...prev,
      other_direct: {
        ...prev.other_direct,
        student_tuition: (prev.other_direct.student_tuition || []).map((tuition, i) => 
          i === index ? { ...tuition, [field]: value } : tuition
        )
      }
    }));
  };

  const addSubaward = () => {
    setBudgetData(prev => ({
      ...prev,
      subawards: [...prev.subawards, { name: '', institution_id: '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }]
    }));
  };

  const removeSubaward = (index) => {
    setBudgetData(prev => ({
      ...prev,
      subawards: prev.subawards.filter((_, i) => i !== index)
    }));
  };

  const updateSubawardField = (index, field, value) => {
    setBudgetData(prev => ({
      ...prev,
      subawards: prev.subawards.map((subaward, i) => 
        i === index ? { ...subaward, [field]: value } : subaward
      )
    }));
  };

  const calculateTotal = (category, item) => {
    const data = budgetData[category][item];
    const y1 = parseFloat(data.y1) || 0;
    const y2 = parseFloat(data.y2) || 0;
    const y3 = parseFloat(data.y3) || 0;
    const y4 = parseFloat(data.y4) || 0;
    const y5 = parseFloat(data.y5) || 0;
    return (y1 + y2 + y3 + y4 + y5).toFixed(2);
  };

  const calculateRowTotal = (category, item) => {
    return calculateTotal(category, item);
  };

  return (
    <div className="step budget-spreadsheet">
      <form onSubmit={handleSubmit}>
        {/* Project Information Section */}
        <div className="project-info">
          <div className="info-row">
            <label>Title:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="info-input"
              required
            />
          </div>
          <div className="info-row">
            <label>Funding source:</label>
            <select
              value={formData.agency || ''}
              onChange={(e) => setFormData({...formData, agency: e.target.value})}
              className="form-select"
            >
              <option value="">-- Select Funding Source --</option>
              {institutions && institutions.map(institution => (
                <option key={institution.institution_id} value={institution.name}>
                  {institution.name}
                </option>
              ))}
            </select>
          </div>
          <div className="info-row">
            <label>Project Start and End Dates:</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({...formData, start_date: e.target.value})}
              className="info-input"
              style={{width: '150px', marginRight: '10px'}}
            />
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({...formData, end_date: e.target.value})}
              className="info-input"
              style={{width: '150px'}}
            />
          </div>
        </div>

        {/* Budget Table - Personnel Sections */}
        <div className="budget-table-container">
          <table className="budget-table">
            <thead>
              <tr>
                <th rowSpan="2" style={{minWidth: '200px'}}></th>
                <th rowSpan="2" style={{minWidth: '100px'}}>Effort %</th>
                <th rowSpan="2" style={{minWidth: '150px'}}>Hourly rate at</th>
                <th rowSpan="2" style={{minWidth: '80px'}}>Max hours/week</th>
                <th colSpan="5">Year</th>
                <th rowSpan="2" style={{minWidth: '100px'}}>Total</th>
                <th rowSpan="2" style={{minWidth: '250px'}}>Notes</th>
              </tr>
              <tr>
                <th style={{minWidth: '90px'}}>
                  Y1 ({yearRates.y1.year})
                  <div style={{fontSize: '10px', fontWeight: 'normal', color: '#666'}}>
                    Fringe: {yearRates.y1.fringe}
                  </div>
                </th>
                <th style={{minWidth: '90px'}}>
                  Y2 ({yearRates.y2.year})
                  <div style={{fontSize: '10px', fontWeight: 'normal', color: '#666'}}>
                    Fringe: {yearRates.y2.fringe}
                  </div>
                </th>
                <th style={{minWidth: '90px'}}>
                  Y3 ({yearRates.y3.year})
                  <div style={{fontSize: '10px', fontWeight: 'normal', color: '#666'}}>
                    Fringe: {yearRates.y3.fringe}
                  </div>
                </th>
                <th style={{minWidth: '90px'}}>
                  Y4 ({yearRates.y4.year})
                  <div style={{fontSize: '10px', fontWeight: 'normal', color: '#666'}}>
                    Fringe: {yearRates.y4.fringe}
                  </div>
                </th>
                <th style={{minWidth: '90px'}}>
                  Y5 ({yearRates.y5.year})
                  <div style={{fontSize: '10px', fontWeight: 'normal', color: '#666'}}>
                    Fringe: {yearRates.y5.fringe}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Personnel Compensation */}
              <tr className="section-header">
                <td colSpan="11"><strong>Personnel Compensation</strong></td>
              </tr>
              <tr>
                <td className="label-cell">
                  <select
                    value={budgetData.personnel.pi.user_id || ''}
                    onChange={(e) => {
                      const selectedUser = piUsers.find(u => u.user_id === parseInt(e.target.value));
                      if (selectedUser) {
                        updateBudgetField('personnel', 'pi', 'user_id', selectedUser.user_id);
                        updateBudgetField('personnel', 'pi', 'name', `${selectedUser.first_name} ${selectedUser.last_name}`);
                      }
                    }}
                    style={{width: '100%', padding: '4px', border: '1px solid #ccc', marginBottom: '5px'}}
                  >
                    <option value="">-- Select PI --</option>
                    {piUsers.map(user => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                  </select>
                  PI
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.effort_percentage}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Validate effort percentage (0-100)
                      if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                        updateBudgetField('personnel', 'pi', 'effort_percentage', value);
                      }
                    }}
                    placeholder="%"
                    className="table-input"
                    title="Percentage of effort (0-100%)"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.hourly_rate || ''}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'hourly_rate', e.target.value)}
                    className="table-input"
                    placeholder="$/hr"
                    title="Hourly rate"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.y1_hours || ''}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'y1_hours', e.target.value)}
                    className="table-input"
                    placeholder=""
                    title="Hours per week"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.y1}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'y1', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.y2}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'y2', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.y3}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'y3', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.y4}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'y4', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.personnel.pi.y5}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'y5', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td className="total-cell">
                  {(() => {
                    // Sum year values (already effort-adjusted)
                    const total = (parseFloat(budgetData.personnel.pi.y1) || 0) + 
                                  (parseFloat(budgetData.personnel.pi.y2) || 0) + 
                                  (parseFloat(budgetData.personnel.pi.y3) || 0) + 
                                  (parseFloat(budgetData.personnel.pi.y4) || 0) + 
                                  (parseFloat(budgetData.personnel.pi.y5) || 0);
                    return total.toFixed(2);
                  })()}
                </td>
                <td className="notes-cell">
                  <input
                    type="text"
                    value={budgetData.personnel.pi.notes}
                    onChange={(e) => updateBudgetField('personnel', 'pi', 'notes', e.target.value)}
                    className="table-input notes-input"
                  />
                </td>
              </tr>
              {budgetData.personnel.co_pis.map((coPi, index) => (
                <tr key={`co-pi-${index}`}>
                  <td className="label-cell">
                    <select
                      value={coPi.user_id || ''}
                      onChange={(e) => {
                        const selectedUser = coPiUsers.find(u => u.user_id === parseInt(e.target.value));
                        if (selectedUser) {
                          updateCoPIField(index, 'user_id', selectedUser.user_id);
                          updateCoPIField(index, 'name', `${selectedUser.first_name} ${selectedUser.last_name}`);
                        }
                      }}
                      style={{width: '100%', padding: '4px', border: '1px solid #ccc', marginBottom: '5px'}}
                    >
                      <option value="">-- Select Co-PI --</option>
                      {coPiUsers.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </select>
                    Co-PI {index + 1}
                    <button 
                      type="button" 
                      onClick={() => removeCoPI(index)}
                      className="remove-button"
                      style={{marginLeft: '10px', padding: '2px 8px', fontSize: '11px'}}
                    >
                      Remove
                    </button>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.effort_percentage || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Validate effort percentage (0-100)
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                          updateCoPIField(index, 'effort_percentage', value);
                        }
                      }}
                      placeholder="%"
                      className="table-input"
                      title="Percentage of effort (0-100%)"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.hourly_rate || ''}
                      onChange={(e) => updateCoPIField(index, 'hourly_rate', e.target.value)}
                      className="table-input"
                      placeholder="$/hr"
                      title="Hourly rate"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.y1_hours || ''}
                      onChange={(e) => updateCoPIField(index, 'y1_hours', e.target.value)}
                      className="table-input"
                      placeholder=""
                      title="Hours per week"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.y1}
                      onChange={(e) => updateCoPIField(index, 'y1', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.y2}
                      onChange={(e) => updateCoPIField(index, 'y2', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.y3}
                      onChange={(e) => updateCoPIField(index, 'y3', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.y4}
                      onChange={(e) => updateCoPIField(index, 'y4', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={coPi.y5}
                      onChange={(e) => updateCoPIField(index, 'y5', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td className="total-cell">
                    {(() => {
                      // Sum year values (already effort-adjusted)
                      const total = (parseFloat(coPi.y1) || 0) + 
                                    (parseFloat(coPi.y2) || 0) + 
                                    (parseFloat(coPi.y3) || 0) + 
                                    (parseFloat(coPi.y4) || 0) + 
                                    (parseFloat(coPi.y5) || 0);
                      return total.toFixed(2);
                    })()}
                  </td>
                  <td className="notes-cell">
                    <input
                      type="text"
                      value={coPi.notes}
                      onChange={(e) => updateCoPIField(index, 'notes', e.target.value)}
                      className="table-input notes-input"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan="11" style={{padding: '10px', textAlign: 'center'}}>
                  <button type="button" onClick={addCoPI} className="add-button" style={{padding: '5px 15px'}}>
                    + Add Co-PI
                  </button>
                </td>
              </tr>

              {/* Additional Faculty Members */}
              {budgetData.personnel.faculty && budgetData.personnel.faculty.map((faculty, index) => (
                <tr key={`faculty-${index}`}>
                  <td className="label-cell">
                    <select
                      value={faculty.user_id || ''}
                      onChange={(e) => {
                        const selectedUser = facultyUsers.find(u => u.user_id === parseInt(e.target.value));
                        if (selectedUser) {
                          updateFacultyField(index, 'user_id', selectedUser.user_id);
                          updateFacultyField(index, 'name', `${selectedUser.first_name} ${selectedUser.last_name}`);
                        }
                      }}
                      style={{width: '100%', padding: '4px', border: '1px solid #ccc', marginBottom: '5px'}}
                    >
                      <option value="">-- Select Faculty --</option>
                      {facultyUsers.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </select>
                    Faculty {index + 1}
                    <button 
                      type="button" 
                      onClick={() => removeFaculty(index)}
                      className="remove-button"
                      style={{marginLeft: '10px', padding: '2px 8px', fontSize: '11px'}}
                    >
                      Remove
                    </button>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.effort_percentage || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                          updateFacultyField(index, 'effort_percentage', value);
                        }
                      }}
                      placeholder="%"
                      className="table-input"
                      title="Percentage of effort (0-100%)"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.hourly_rate || ''}
                      onChange={(e) => updateFacultyField(index, 'hourly_rate', e.target.value)}
                      className="table-input"
                      placeholder="$/hr"
                      title="Hourly rate"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.y1_hours || ''}
                      onChange={(e) => updateFacultyField(index, 'y1_hours', e.target.value)}
                      className="table-input"
                      placeholder=""
                      title="Hours per week"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.y1}
                      onChange={(e) => updateFacultyField(index, 'y1', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.y2}
                      onChange={(e) => updateFacultyField(index, 'y2', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.y3}
                      onChange={(e) => updateFacultyField(index, 'y3', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.y4}
                      onChange={(e) => updateFacultyField(index, 'y4', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={faculty.y5}
                      onChange={(e) => updateFacultyField(index, 'y5', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td className="total-cell">
                    {(() => {
                      // Sum year values (already effort-adjusted)
                      const total = (parseFloat(faculty.y1) || 0) + 
                                    (parseFloat(faculty.y2) || 0) + 
                                    (parseFloat(faculty.y3) || 0) + 
                                    (parseFloat(faculty.y4) || 0) + 
                                    (parseFloat(faculty.y5) || 0);
                      return total.toFixed(2);
                    })()}
                  </td>
                  <td className="notes-cell">
                    <input
                      type="text"
                      value={faculty.notes}
                      onChange={(e) => updateFacultyField(index, 'notes', e.target.value)}
                      className="table-input notes-input"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan="11" style={{padding: '10px', textAlign: 'center'}}>
                  <button type="button" onClick={addFaculty} className="add-button" style={{padding: '5px 15px'}}>
                    + Add Faculty Member
                  </button>
                </td>
              </tr>

              {/* Other Personnel */}
              <tr className="section-header">
                <td colSpan="11"><strong>Other Personnel</strong></td>
              </tr>
              <BudgetRow
                label="Professional Staff & Post Docs"
                data={budgetData.other_personnel.professional_staff}
                onUpdate={(field, value) => updateBudgetField('other_personnel', 'professional_staff', field, value)}
                showHourly={true}
              />
              {/* Students - Multiple entries */}
              {budgetData.other_personnel.gras_ugrads && budgetData.other_personnel.gras_ugrads.map((student, index) => (
                <tr key={`student-${index}`}>
                  <td className="label-cell">
                    <div style={{marginBottom: '5px'}}>Student {index + 1}</div>
                    {students && students.length > 0 ? (
                      <select
                        value={student.student_id || ''}
                        onChange={(e) => {
                          const selectedStudent = students.find(s => s.student_id === parseInt(e.target.value));
                          updateStudentField(index, 'student_id', e.target.value);
                        }}
                        style={{width: '100%', padding: '4px', border: '1px solid #ccc', fontSize: '12px'}}
                      >
                        <option value="">-- Select Student --</option>
                        {students.filter(s => s.student_type === 'Graduate_Student' || s.student_type === 'Undergraduate').map(s => (
                          <option key={s.student_id} value={s.student_id}>
                            {s.first_name} {s.last_name} ({s.student_type.replace('_', ' ')} - {s.residency_status.replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button 
                      type="button" 
                      onClick={() => removeStudent(index)}
                      className="remove-button"
                      style={{marginTop: '5px', padding: '2px 8px', fontSize: '11px'}}
                    >
                      Remove
                    </button>
                  </td>
                  {/* Effort % column */}
                  <td>
                    <input
                      type="text"
                      value={student.effort_percentage || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                          updateStudentField(index, 'effort_percentage', value);
                        }
                      }}
                      placeholder="%"
                      className="table-input"
                      title="Percentage of effort (0-100%)"
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.hourly_rate || ''}
                      onChange={(e) => updateStudentField(index, 'hourly_rate', e.target.value)}
                      className="table-input"
                      placeholder="$/hr"
                      title="Hourly rate"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.y1_hours || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const hours = parseFloat(value) || 0;
                        if (hours > 20) {
                          alert('Students are limited to a maximum of 50% FTE (20 hours per week). Please adjust the hours.');
                          updateStudentField(index, 'y1_hours', '20');
                          return;
                        }
                        updateStudentField(index, 'y1_hours', value);
                      }}
                      placeholder="20"
                      className="table-input"
                      title="Maximum hours per week (max 20 for students)"
                      max="20"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.y1 || ''}
                      onChange={(e) => updateStudentField(index, 'y1', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.y2 || ''}
                      onChange={(e) => updateStudentField(index, 'y2', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.y3 || ''}
                      onChange={(e) => updateStudentField(index, 'y3', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.y4 || ''}
                      onChange={(e) => updateStudentField(index, 'y4', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={student.y5 || ''}
                      onChange={(e) => updateStudentField(index, 'y5', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td className="total-cell">
                    {((parseFloat(student.y1) || 0) + (parseFloat(student.y2) || 0) + (parseFloat(student.y3) || 0) + (parseFloat(student.y4) || 0) + (parseFloat(student.y5) || 0)).toFixed(2)}
                  </td>
                  <td className="notes-cell">
                    <span className="special-note" style={{fontSize: '10px', color: '#666', display: 'block', marginBottom: '2px'}}>Max 50% FTE (20 hrs/week)</span>
                    <input
                      type="text"
                      value={student.notes || ''}
                      onChange={(e) => updateStudentField(index, 'notes', e.target.value)}
                      className="table-input notes-input"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan="11" style={{padding: '10px', textAlign: 'center'}}>
                  <button type="button" onClick={addStudent} className="add-button" style={{padding: '5px 15px'}}>
                    + Add Student
                  </button>
                </td>
              </tr>
              <BudgetRow
                label="Temp Help"
                data={budgetData.other_personnel.temp_help}
                onUpdate={(field, value) => updateBudgetField('other_personnel', 'temp_help', field, value)}
                showHourly={true}
              />
            </tbody>
          </table>
        </div>

        {/* Budget Table - Other Items */}
        <div className="budget-table-container">
          <table className="budget-table">
            <thead>
              <tr>
                <th rowSpan="2" style={{minWidth: '200px'}}></th>
                <th colSpan="5">Year</th>
                <th rowSpan="2" style={{minWidth: '100px'}}>Total</th>
                <th rowSpan="2" style={{minWidth: '250px'}}>Notes</th>
              </tr>
              <tr>
                <th style={{minWidth: '90px'}}>Y1</th>
                <th style={{minWidth: '90px'}}>Y2</th>
                <th style={{minWidth: '90px'}}>Y3</th>
                <th style={{minWidth: '90px'}}>Y4</th>
                <th style={{minWidth: '90px'}}>Y5</th>
              </tr>
            </thead>
            <tbody>
              {/* Equipment */}
              <tr className="section-header">
                <td colSpan="7"><strong>Equipment &gt;$5000.00</strong></td>
              </tr>
              <SimpleBudgetRow
                label="Equipment &gt;$5000.00"
                data={budgetData.equipment.over_5k}
                onUpdate={(field, value) => updateBudgetField('equipment', 'over_5k', field, value)}
              />

              {/* Travel */}
              <tr className="section-header">
                <td colSpan="7"><strong>Travel</strong></td>
              </tr>
              <tr>
                <td className="label-cell">
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>Domestic</span>
                    <button
                      type="button"
                      onClick={() => setShowTravelCalculator({type: 'domestic', field: 'domestic'})}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                      title="Calculate using travel profiles"
                    >
                      📍 Calculate
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.domestic.y1}
                    onChange={(e) => updateBudgetField('travel', 'domestic', 'y1', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.domestic.y2}
                    onChange={(e) => updateBudgetField('travel', 'domestic', 'y2', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.domestic.y3}
                    onChange={(e) => updateBudgetField('travel', 'domestic', 'y3', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.domestic.y4}
                    onChange={(e) => updateBudgetField('travel', 'domestic', 'y4', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.domestic.y5}
                    onChange={(e) => updateBudgetField('travel', 'domestic', 'y5', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td className="total-cell">
                  {((parseFloat(budgetData.travel.domestic.y1) || 0) + (parseFloat(budgetData.travel.domestic.y2) || 0) + (parseFloat(budgetData.travel.domestic.y3) || 0) + (parseFloat(budgetData.travel.domestic.y4) || 0) + (parseFloat(budgetData.travel.domestic.y5) || 0)).toFixed(2)}
                </td>
                <td className="notes-cell">
                  <input
                    type="text"
                    value={budgetData.travel.domestic.notes}
                    onChange={(e) => updateBudgetField('travel', 'domestic', 'notes', e.target.value)}
                    className="table-input notes-input"
                  />
                </td>
              </tr>
              <tr>
                <td className="label-cell">
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>International</span>
                    <button
                      type="button"
                      onClick={() => setShowTravelCalculator({type: 'international', field: 'international'})}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                      title="Calculate using travel profiles"
                    >
                      📍 Calculate
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.international.y1}
                    onChange={(e) => updateBudgetField('travel', 'international', 'y1', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.international.y2}
                    onChange={(e) => updateBudgetField('travel', 'international', 'y2', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.international.y3}
                    onChange={(e) => updateBudgetField('travel', 'international', 'y3', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.international.y4}
                    onChange={(e) => updateBudgetField('travel', 'international', 'y4', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={budgetData.travel.international.y5}
                    onChange={(e) => updateBudgetField('travel', 'international', 'y5', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td className="total-cell">
                  {((parseFloat(budgetData.travel.international.y1) || 0) + (parseFloat(budgetData.travel.international.y2) || 0) + (parseFloat(budgetData.travel.international.y3) || 0) + (parseFloat(budgetData.travel.international.y4) || 0) + (parseFloat(budgetData.travel.international.y5) || 0)).toFixed(2)}
                </td>
                <td className="notes-cell">
                  <input
                    type="text"
                    value={budgetData.travel.international.notes}
                    onChange={(e) => updateBudgetField('travel', 'international', 'notes', e.target.value)}
                    className="table-input notes-input"
                  />
                </td>
              </tr>

              {/* Participant Support Costs */}
              <tr className="section-header">
                <td colSpan="7"><strong>Participant Support Costs (NSF only)</strong></td>
              </tr>
              <SimpleBudgetRow
                label="Participant Support Costs"
                data={budgetData.participant_support.nsf}
                onUpdate={(field, value) => updateBudgetField('participant_support', 'nsf', field, value)}
              />

              {/* Other Direct Costs */}
              <tr className="section-header">
                <td colSpan="7"><strong>Other Direct Costs</strong></td>
              </tr>
              <SimpleBudgetRow
                label="Materials and supplies"
                data={budgetData.other_direct.materials_supplies}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'materials_supplies', field, value)}
              />
              <SimpleBudgetRow
                label="&lt;$5K small equipment"
                data={budgetData.other_direct.small_equipment}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'small_equipment', field, value)}
              />
              <SimpleBudgetRow
                label="Publication costs"
                data={budgetData.other_direct.publication}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'publication', field, value)}
              />
              <SimpleBudgetRow
                label="Computer services"
                data={budgetData.other_direct.computer_services}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'computer_services', field, value)}
              />
              <SimpleBudgetRow
                label="Software"
                data={budgetData.other_direct.software}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'software', field, value)}
              />
              <SimpleBudgetRow
                label="Facility usage fees"
                data={budgetData.other_direct.facility_fees}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'facility_fees', field, value)}
              />
              <SimpleBudgetRow
                label="Conference Registration"
                data={budgetData.other_direct.conference_reg}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'conference_reg', field, value)}
              />
              <SimpleBudgetRow
                label="Other"
                data={budgetData.other_direct.other1}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'other1', field, value)}
              />
              <SimpleBudgetRow
                label="Other"
                data={budgetData.other_direct.other2}
                onUpdate={(field, value) => updateBudgetField('other_direct', 'other2', field, value)}
              />
              {/* Student Tuition & Health Insurance - Per Student */}
              <tr className="section-header">
                <td colSpan="7">
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <strong>Student Tuition & Health Insurance</strong>
                    <button
                      type="button"
                      onClick={() => setShowTuitionCalculator(true)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                      title="Calculate tuition using tuition schedules"
                    >
                      🎓 Calculate Tuition
                    </button>
                  </div>
                </td>
              </tr>
              {budgetData.other_direct.student_tuition && budgetData.other_direct.student_tuition.map((tuition, index) => (
                <tr key={`tuition-${index}`}>
                  <td className="label-cell">
                    <div style={{marginBottom: '5px'}}>Student {index + 1}</div>
                    {students && students.length > 0 ? (
                      <select
                        value={tuition.student_id || ''}
                        onChange={(e) => {
                          const selectedStudent = students.find(s => s.student_id === parseInt(e.target.value));
                          updateStudentTuitionField(index, 'student_id', e.target.value);
                        }}
                        style={{width: '100%', padding: '4px', border: '1px solid #ccc', fontSize: '12px'}}
                      >
                        <option value="">-- Select Student --</option>
                        {students.filter(s => s.student_type === 'Graduate_Student' || s.student_type === 'Undergraduate').map(s => (
                          <option key={s.student_id} value={s.student_id}>
                            {s.first_name} {s.last_name} ({s.student_type.replace('_', ' ')} - {s.residency_status.replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button 
                      type="button" 
                      onClick={() => removeStudentTuition(index)}
                      className="remove-button"
                      style={{marginTop: '5px', padding: '2px 8px', fontSize: '11px'}}
                    >
                      Remove
                    </button>
                  </td>
                <td>
                  <input
                    type="text"
                      value={tuition.y1 || ''}
                      onChange={(e) => updateStudentTuitionField(index, 'y1', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                      value={tuition.y2 || ''}
                      onChange={(e) => updateStudentTuitionField(index, 'y2', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                      value={tuition.y3 || ''}
                      onChange={(e) => updateStudentTuitionField(index, 'y3', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                      value={tuition.y4 || ''}
                      onChange={(e) => updateStudentTuitionField(index, 'y4', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                      value={tuition.y5 || ''}
                      onChange={(e) => updateStudentTuitionField(index, 'y5', e.target.value)}
                    className="table-input"
                  />
                </td>
                <td className="total-cell">
                    {((parseFloat(tuition.y1) || 0) + (parseFloat(tuition.y2) || 0) + (parseFloat(tuition.y3) || 0) + (parseFloat(tuition.y4) || 0) + (parseFloat(tuition.y5) || 0)).toFixed(2)}
                </td>
                <td className="notes-cell">
                  <input
                    type="text"
                      value={tuition.notes || ''}
                      onChange={(e) => updateStudentTuitionField(index, 'notes', e.target.value)}
                    className="table-input notes-input"
                  />
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Budget Table - Subawards (Separate table with Partner University column) */}
        <div className="budget-table-container">
          <table className="budget-table">
            <thead>
              <tr>
                <th rowSpan="2" style={{minWidth: '200px'}}></th>
                <th rowSpan="2" style={{minWidth: '200px'}}>Partner University</th>
                <th colSpan="5">Year</th>
                <th rowSpan="2" style={{minWidth: '100px'}}>Total</th>
                <th rowSpan="2" style={{minWidth: '250px'}}>Notes</th>
              </tr>
              <tr>
                <th style={{minWidth: '90px'}}>Y1</th>
                <th style={{minWidth: '90px'}}>Y2</th>
                <th style={{minWidth: '90px'}}>Y3</th>
                <th style={{minWidth: '90px'}}>Y4</th>
                <th style={{minWidth: '90px'}}>Y5</th>
              </tr>
            </thead>
            <tbody>
              {/* Consortia/Subawards */}
              <tr className="section-header">
                <td colSpan="8"><strong>Consortia/Subawards</strong></td>
              </tr>
              {budgetData.subawards.map((subaward, index) => (
                <tr key={`subaward-${index}`}>
                  <td className="label-cell">
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                      <input
                        type="text"
                        value={subaward.name}
                        onChange={(e) => updateSubawardField(index, 'name', e.target.value)}
                        placeholder={`Sub award ${index + 1} name`}
                        style={{flex: 1, padding: '4px', border: '1px solid #ccc', fontSize: '13px'}}
                      />
                      <button 
                        type="button" 
                        onClick={() => removeSubaward(index)}
                        className="remove-button"
                        style={{padding: '4px 8px', fontSize: '11px'}}
                        title="Remove this subaward"
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{fontSize: '12px', color: '#666', fontStyle: 'italic'}}>
                      {subaward.name || `Sub award ${index + 1}`}
                    </div>
                  </td>
                  <td>
                    <select
                      value={subaward.institution_id || ''}
                      onChange={(e) => updateSubawardField(index, 'institution_id', e.target.value)}
                      style={{width: '100%', padding: '4px', border: '1px solid #ccc', fontSize: '12px'}}
                    >
                      <option value="">-- Select Partner University --</option>
                      {institutions && institutions.filter(inst => inst.institution_id !== 1).map(institution => (
                        <option key={institution.institution_id} value={institution.institution_id}>
                          {institution.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={subaward.y1}
                      onChange={(e) => updateSubawardField(index, 'y1', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={subaward.y2}
                      onChange={(e) => updateSubawardField(index, 'y2', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={subaward.y3}
                      onChange={(e) => updateSubawardField(index, 'y3', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={subaward.y4}
                      onChange={(e) => updateSubawardField(index, 'y4', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={subaward.y5}
                      onChange={(e) => updateSubawardField(index, 'y5', e.target.value)}
                      className="table-input"
                    />
                  </td>
                  <td className="total-cell">
                    {((parseFloat(subaward.y1) || 0) + (parseFloat(subaward.y2) || 0) + (parseFloat(subaward.y3) || 0) + (parseFloat(subaward.y4) || 0) + (parseFloat(subaward.y5) || 0)).toFixed(2)}
                  </td>
                  <td className="notes-cell">
                    <span className="special-note"></span>
                    <input
                      type="text"
                      value={subaward.notes}
                      onChange={(e) => updateSubawardField(index, 'notes', e.target.value)}
                      className="table-input notes-input"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan="8" style={{padding: '10px', textAlign: 'center'}}>
                  <button type="button" onClick={addSubaward} className="add-button" style={{padding: '5px 15px'}}>
                    + Add Subaward
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tuition Calculator Modal */}
        {showTuitionCalculator && (
          <TuitionCalculatorModal
            students={students}
            onCalculate={async (studentId, years, includeSummer, targetYear) => {
              try {
              const result = await calculateTuitionForStudent(studentId, years, includeSummer);
                if (result && result.yearly_breakdown && result.yearly_breakdown.length > 0) {
                  // Create a new student tuition entry
                  const newTuitionEntry = { student_id: studentId.toString(), y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' };
                  
                // Distribute tuition across years starting from targetYear
                result.yearly_breakdown.forEach((yearData, idx) => {
                  const yearField = `y${targetYear + idx}`;
                    if (yearField.match(/^y[1-5]$/)) {
                      const yearTotal = parseFloat(yearData.year_total) || 0;
                      if (yearTotal > 0) {
                        newTuitionEntry[yearField] = yearTotal.toFixed(2);
                      }
                    }
                  });
                  
                  // Add the new entry to the student_tuition array
                  setBudgetData(prev => ({
                    ...prev,
                    other_direct: {
                      ...prev.other_direct,
                      student_tuition: [...(prev.other_direct.student_tuition || []), newTuitionEntry]
                  }
                  }));
                  
                setShowTuitionCalculator(false);
                } else {
                  alert('Failed to calculate tuition. Please check that the student has valid tuition schedules in the database.');
                }
              } catch (error) {
                console.error('Error in tuition calculation:', error);
                alert('An error occurred while calculating tuition. Please try again.');
              }
            }}
            onClose={() => setShowTuitionCalculator(false)}
          />
        )}

        {/* Travel Calculator Modal */}
        {showTravelCalculator && (
          <TravelCalculatorModal
            travelType={showTravelCalculator.type}
            domesticProfiles={domesticTravelProfiles}
            internationalProfiles={internationalTravelProfiles}
            onCalculate={async (location, numTravelers, numNights, targetYear) => {
              try {
              const result = await calculateTravelCost(showTravelCalculator.type, location, numTravelers, numNights);
                if (result && result.total_cost) {
                const yearField = `y${targetYear}`;
                const fieldPath = showTravelCalculator.field;
                if (yearField.match(/^y[1-5]$/)) {
                    const totalCost = parseFloat(result.total_cost) || 0;
                    if (totalCost > 0) {
                      updateBudgetField('travel', fieldPath, yearField, totalCost.toFixed(2));
                setShowTravelCalculator(false);
                    } else {
                      alert('Travel calculation returned $0. Please check the travel profile data.');
                    }
                  } else {
                    alert('Invalid year selected.');
                  }
                } else {
                  alert('Failed to calculate travel cost. Please check that a valid location profile exists in the database.');
                }
              } catch (error) {
                console.error('Error in travel calculation:', error);
                alert('An error occurred while calculating travel cost. Please try again.');
              }
            }}
            onClose={() => setShowTravelCalculator(false)}
          />
        )}

        <div className="form-actions">
          <button type="submit" className="submit-button">Create Proposal</button>
        </div>
      </form>
    </div>
  );
}

// Tuition Calculator Modal Component
function TuitionCalculatorModal({ students, onCalculate, onClose }) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [years, setYears] = useState(1);
  const [includeSummer, setIncludeSummer] = useState(false);
  const [targetYear, setTargetYear] = useState(1);

  const handleCalculate = () => {
    if (selectedStudent) {
      const studentId = parseInt(selectedStudent);
      if (!isNaN(studentId)) {
        onCalculate(studentId, years, includeSummer, targetYear);
      } else {
        alert('Please select a valid student');
      }
    } else {
      alert('Please select a student');
    }
  };

  const graduateStudents = students.filter(s => s.student_type === 'Graduate_Student');
  const undergraduateStudents = students.filter(s => s.student_type === 'Undergraduate');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h3 style={{marginTop: 0}}>Tuition Calculator</h3>
        
        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Select Student:</label>
          {students && students.length > 0 ? (
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="form-select"
          >
            <option value="">-- Select a student --</option>
            {graduateStudents.length > 0 && (
              <optgroup label="Graduate Students">
                {graduateStudents.map(student => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.first_name} {student.last_name} ({student.residency_status.replace('_', ' ')})
                  </option>
                ))}
              </optgroup>
            )}
            {undergraduateStudents.length > 0 && (
              <optgroup label="Undergraduate Students">
                {undergraduateStudents.map(student => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.first_name} {student.last_name} ({student.residency_status.replace('_', ' ')})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          ) : (
            <div style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#666'}}>
              Loading students...
            </div>
          )}
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Number of Years:</label>
          <input
            type="number"
            min="1"
            max="5"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value))}
            className="form-select"
          />
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <input
              type="checkbox"
              checked={includeSummer}
              onChange={(e) => setIncludeSummer(e.target.checked)}
            />
            <span>Include Summer Semester</span>
          </label>
        </div>

        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Start Year (Y1, Y2, etc.):</label>
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(parseInt(e.target.value))}
            className="form-select"
          >
            <option value={1}>Year 1</option>
            <option value={2}>Year 2</option>
            <option value={3}>Year 3</option>
            <option value={4}>Year 4</option>
            <option value={5}>Year 5</option>
          </select>
        </div>

        <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={!selectedStudent}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedStudent ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedStudent ? 'pointer' : 'not-allowed'
            }}
          >
            Calculate & Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Travel Calculator Modal Component
function TravelCalculatorModal({ travelType, domesticProfiles, internationalProfiles, onCalculate, onClose }) {
  const [location, setLocation] = useState('');
  const [numTravelers, setNumTravelers] = useState(1);
  const [numNights, setNumNights] = useState(1);
  const [targetYear, setTargetYear] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const profiles = travelType === 'domestic' ? domesticProfiles : internationalProfiles;

  

  const handleCalculate = () => {
    if (location && selectedProfile) {
      
      let searchLocation = location;
      if (travelType === 'international' && selectedProfile) {
        // Use country or city from the profile for better matching
        searchLocation = selectedProfile.country || selectedProfile.city || location;
      } else if (travelType === 'domestic' && selectedProfile) {
        // Use location_name or city from the profile
        searchLocation = selectedProfile.location_name || selectedProfile.city || location;
      }
      onCalculate(searchLocation, numTravelers, numNights, targetYear);
    } else {
      alert('Please select a location from the dropdown');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>
          {travelType === 'domestic' ? 'Domestic' : 'International'} Travel Calculator
        </h3>
        
        <div className="form-group">
          <label className="form-label">
            {travelType === 'domestic' ? 'Location (City, State):' : 'Location (Country, City):'}
          </label>
          {profiles && profiles.length > 0 ? (
            <select
            value={location}
              onChange={(e) => {
                const loc = e.target.value;
                setLocation(loc);
                // Find matching profile
                const profile = profiles.find(p => {
                  if (travelType === 'domestic') {
                    const displayValue = `${p.city || ''}, ${p.state || ''}`.trim();
                    return displayValue === loc || p.location_name === loc;
                  } else {
                    const displayValue = `${p.city || ''}, ${p.country || ''}`.trim();
                    return displayValue === loc || p.country === loc;
                  }
                });
                setSelectedProfile(profile || null);
              }}
            className="form-select"
            >
              <option value="">-- Select Location --</option>
              {profiles.map(profile => {
                const displayValue = travelType === 'domestic' 
                  ? `${profile.city || ''}, ${profile.state || ''}`.trim() || profile.location_name
                  : `${profile.city || ''}, ${profile.country || ''}`.trim() || profile.country;
                return (
                  <option key={profile.profile_id} value={displayValue}>
                    {displayValue}
                  </option>
                );
              })}
            </select>
          ) : (
            <div style={{padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#666'}}>
              Loading locations...
            </div>
          )}
          {selectedProfile && (
            <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '12px'}}>
              <p><strong>Per Diem:</strong> ${selectedProfile.per_diem_rate}</p>
              <p><strong>Lodging Cap:</strong> ${selectedProfile.lodging_cap_per_night}/night</p>
              <p><strong>Airfare Estimate:</strong> ${selectedProfile.airfare_estimate || 'N/A'}</p>
            </div>
          )}
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Number of Travelers:</label>
          <input
            type="number"
            min="1"
            value={numTravelers}
            onChange={(e) => setNumTravelers(parseInt(e.target.value))}
            className="form-select"
          />
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Number of Nights:</label>
          <input
            type="number"
            min="1"
            value={numNights}
            onChange={(e) => setNumNights(parseInt(e.target.value))}
            className="form-select"
          />
        </div>

        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Apply to Year:</label>
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(parseInt(e.target.value))}
            className="form-select"
          >
            <option value={1}>Year 1</option>
            <option value={2}>Year 2</option>
            <option value={3}>Year 3</option>
            <option value={4}>Year 4</option>
            <option value={5}>Year 5</option>
          </select>
        </div>

        {selectedProfile && (
          <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '4px'}}>
            <h4 style={{marginTop: 0}}>Estimated Cost:</h4>
            <p>Per Traveler: ${(
              (parseFloat(selectedProfile.per_diem_rate) * numNights) +
              (parseFloat(selectedProfile.lodging_cap_per_night) * numNights) +
              (parseFloat(selectedProfile.airfare_estimate || 0)) +
              (parseFloat(selectedProfile.ground_transportation_estimate || 0))
            ).toFixed(2)}</p>
            <p><strong>Total ({numTravelers} travelers):</strong> ${(
              ((parseFloat(selectedProfile.per_diem_rate) * numNights) +
              (parseFloat(selectedProfile.lodging_cap_per_night) * numNights) +
              (parseFloat(selectedProfile.airfare_estimate || 0)) +
              (parseFloat(selectedProfile.ground_transportation_estimate || 0))) * numTravelers
            ).toFixed(2)}</p>
          </div>
        )}

        <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={!location || !selectedProfile}
            style={{
              padding: '10px 20px',
              backgroundColor: (location && selectedProfile) ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (location && selectedProfile) ? 'pointer' : 'not-allowed'
            }}
          >
            Calculate & Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetRow({ label, data, onUpdate, showHourly, specialNote, students, isStudentRow }) {
  const calculateTotal = () => {
    const y1 = parseFloat(data.y1) || 0;
    const y2 = parseFloat(data.y2) || 0;
    const y3 = parseFloat(data.y3) || 0;
    const y4 = parseFloat(data.y4) || 0;
    const y5 = parseFloat(data.y5) || 0;
    return (y1 + y2 + y3 + y4 + y5).toFixed(2);
  };

  // Calculate base salary from hourly rate and hours (without effort percentage)
  const calculateBaseSalaryFromHourly = (hourlyRate, hoursPerWeek) => {
    const rate = parseFloat(hourlyRate) || 0;
    const hours = parseFloat(hoursPerWeek) || 0;
    const weeksPerYear = 52;
    
    if (rate > 0 && hours > 0) {
      return (rate * hours * weeksPerYear).toFixed(2);
    }
    return '';
  };

  // Handle hourly rate change
  const handleHourlyRateChange = (value) => {
    onUpdate('hourly_rate', value);
    if (showHourly && data.y1_hours) {
      const calculatedSalary = calculateEffortAdjustedSalary(value, data.y1_hours, data.effort_percentage);
      if (calculatedSalary) {
        // Update all year fields with effort-adjusted salary
        ['y1', 'y2', 'y3', 'y4', 'y5'].forEach(yearKey => {
          onUpdate(yearKey, calculatedSalary);
        });
      }
    }
  };

  // Handle hours per week change
  const handleHoursChange = (value) => {
    // For students, enforce 20 hours maximum
    let hoursValue = value;
    if (isStudentRow) {
      const hoursNum = parseFloat(value) || 0;
      if (hoursNum > 20) {
        hoursValue = '20';
      }
    }
    onUpdate('y1_hours', hoursValue);
    if (showHourly && data.hourly_rate) {
      const calculatedSalary = calculateEffortAdjustedSalary(data.hourly_rate, hoursValue, data.effort_percentage);
      if (calculatedSalary) {
        // Update all year fields with effort-adjusted salary
        ['y1', 'y2', 'y3', 'y4', 'y5'].forEach(yearKey => {
          onUpdate(yearKey, calculatedSalary);
        });
      }
    }
  };

  // Handle effort percentage change
  const handleEffortChange = (value) => {
    // Validate effort percentage (0-100)
    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
      onUpdate('effort_percentage', value);
      // If using hourly calculation, recalculate effort-adjusted salary
      if (showHourly && data.hourly_rate && data.y1_hours) {
        const calculatedSalary = calculateEffortAdjustedSalary(data.hourly_rate, data.y1_hours, value);
        if (calculatedSalary) {
          // Update all year fields with effort-adjusted salary
          ['y1', 'y2', 'y3', 'y4', 'y5'].forEach(yearKey => {
            onUpdate(yearKey, calculatedSalary);
          });
        }
      }
    }
  };

  // Calculate effort-adjusted salary from hourly rate, hours, and effort percentage
  const calculateEffortAdjustedSalary = (hourlyRate, hoursPerWeek, effortPercentage) => {
    const rate = parseFloat(hourlyRate) || 0;
    const hours = parseFloat(hoursPerWeek) || 0;
    const effort = parseFloat(effortPercentage) || 100;
    const weeksPerYear = 52;
    
    if (rate > 0 && hours > 0) {
      const baseSalary = rate * hours * weeksPerYear;
      const effortAdjustedSalary = baseSalary * (effort / 100);
      return effortAdjustedSalary.toFixed(2);
    }
    return '';
  };

  return (
    <tr>
      <td className="label-cell">
        <div style={{marginBottom: isStudentRow ? '5px' : '0'}}>{label}</div>
        {isStudentRow && students && students.length > 0 ? (
          <select
            value={data.student_id || ''}
            onChange={(e) => {
              const selectedStudent = students.find(s => s.student_id === parseInt(e.target.value));
              onUpdate('student_id', e.target.value);
              if (selectedStudent) {
                // Optionally auto-fill name or other fields
              }
            }}
            style={{width: '100%', padding: '4px', border: '1px solid #ccc', fontSize: '12px'}}
          >
            <option value="">-- Select Student --</option>
            {students.filter(s => s.student_type === 'Graduate_Student' || s.student_type === 'Undergraduate').map(student => (
              <option key={student.student_id} value={student.student_id}>
                {student.first_name} {student.last_name} ({student.student_type.replace('_', ' ')} - {student.residency_status.replace('_', ' ')})
              </option>
            ))}
          </select>
        ) : null}
          </td>
      {/* Effort % column - input for other personnel */}
          <td>
            <input
              type="text"
          value={data.effort_percentage || ''}
          onChange={(e) => handleEffortChange(e.target.value)}
          placeholder="%"
              className="table-input"
          title="Percentage of effort (0-100%)"
          style={{width: '100%'}}
            />
          </td>
      {showHourly && (
        <>
      <td>
        <input
          type="text"
              value={data.hourly_rate || ''}
              onChange={(e) => handleHourlyRateChange(e.target.value)}
          className="table-input"
              placeholder="$/hr"
              title="Hourly rate"
        />
      </td>
      <td>
        <input
          type="text"
              value={data.y1_hours || ''}
              onChange={(e) => handleHoursChange(e.target.value)}
          className="table-input"
              placeholder=""
              title={isStudentRow ? "Maximum hours per week (max 20 for students)" : "Hours per week"}
              max={isStudentRow ? 20 : undefined}
        />
      </td>
        </>
      )}
      {!showHourly && <td colSpan="2"></td>}
      <td>
        <input
          type="text"
          value={data.y1}
          onChange={(e) => onUpdate('y1', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y2}
          onChange={(e) => onUpdate('y2', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y3}
          onChange={(e) => onUpdate('y3', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y4}
          onChange={(e) => onUpdate('y4', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y5}
          onChange={(e) => onUpdate('y5', e.target.value)}
          className="table-input"
        />
      </td>
      <td className="total-cell">{calculateTotal()}</td>
      <td className="notes-cell">
        {specialNote && <span className="special-note">{specialNote}</span>}
        <input
          type="text"
          value={data.notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          className="table-input notes-input"
        />
      </td>
    </tr>
  );
}

function SimpleBudgetRow({ label, data, onUpdate, specialNote }) {
  const calculateTotal = () => {
    const y1 = parseFloat(data.y1) || 0;
    const y2 = parseFloat(data.y2) || 0;
    const y3 = parseFloat(data.y3) || 0;
    const y4 = parseFloat(data.y4) || 0;
    const y5 = parseFloat(data.y5) || 0;
    return (y1 + y2 + y3 + y4 + y5).toFixed(2);
  };

  return (
    <tr>
      <td className="label-cell">{label}</td>
      <td>
        <input
          type="text"
          value={data.y1}
          onChange={(e) => onUpdate('y1', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y2}
          onChange={(e) => onUpdate('y2', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y3}
          onChange={(e) => onUpdate('y3', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y4}
          onChange={(e) => onUpdate('y4', e.target.value)}
          className="table-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={data.y5}
          onChange={(e) => onUpdate('y5', e.target.value)}
          className="table-input"
        />
      </td>
      <td className="total-cell">{calculateTotal()}</td>
      <td className="notes-cell">
        {specialNote && <span className="special-note">{specialNote}</span>}
        <input
          type="text"
          value={data.notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          className="table-input notes-input"
        />
      </td>
    </tr>
  );
}

function SummaryRow({ label }) {
  return (
    <tr className="summary-row">
      <td className="label-cell">{label}</td>
      <td colSpan="2" className="summary-value"></td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="total-cell">.</td>
      <td className="notes-cell"></td>
    </tr>
  );
}

function SimpleSummaryRow({ label }) {
  return (
    <tr className="summary-row">
      <td className="label-cell">{label}</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="summary-value">.</td>
      <td className="total-cell">.</td>
      <td className="notes-cell"></td>
    </tr>
  );
}

function BudgetStep({ budget, budgetTotals, proposal, budgetData }) {
  const [rates, setRates] = useState([]);
  const baseYear = 2024;

  useEffect(() => {
    // Fetch rates for year-specific fringe rate display
    const fetchRates = async () => {
      try {
        const response = await axios.get('/api/rates');
        setRates(response.data || []);
      } catch (error) {
        console.error('Error fetching rates:', error);
      }
    };
    fetchRates();
  }, []);

  // Helper function to get rate by year and type
  const getRateByYear = (rateType, year) => {
    const rate = rates.find(r => r.rate_type === rateType && r.year === year);
    return rate ? parseFloat(rate.rate_amount) : null;
  };

  if (!budgetTotals) {
    return (
      <div className="step">
        <h2>Budget Summary</h2>
        <p>No budget data available. Please go back and create a proposal with budget information.</p>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

  const pieData = [
    { name: 'Personnel', value: budgetTotals.personnel || 0 },
    { name: 'Fringe Benefits', value: budgetTotals.fringe || 0 },
    { name: 'Equipment', value: budgetTotals.equipment || 0 },
    { name: 'Travel', value: budgetTotals.travel || 0 },
    { name: 'Participant Support', value: budgetTotals.participant_support || 0 },
    { name: 'Other Direct Costs', value: budgetTotals.other_direct || 0 },
    { name: 'Subawards', value: budgetTotals.subawards || 0 }
  ].filter(item => item.value > 0);

  const totalDirect = budgetTotals.direct_costs || 0;
  const indirectRate = 0.50; // 50%
  const indirectCost = budgetTotals.fa_overhead || (totalDirect * indirectRate);
  const totalProject = budgetTotals.total || (totalDirect + indirectCost);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatCurrencyValue = (amount) => {
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') {
      // Remove currency symbols, commas, and whitespace
      const cleaned = amount.replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const exportToExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Summary sheet with better formatting
    const summaryData = [
      ['BUDGET SUMMARY'],
      [''],
      ['Proposal Information'],
      ['Proposal Title:', proposal?.title || 'Not specified'],
      ['Funding Source:', proposal?.agency || 'Not specified'],
      ['Export Date:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      [''],
      ['Budget Categories'],
      ['Category', 'Amount ($)', 'Percentage of Direct Costs'],
    ];
    
    // Add category rows with percentages
    const categories = [
      ['Personnel Compensation', budgetTotals.personnel || 0],
      ['Fringe Benefits', budgetTotals.fringe || 0],
      ['Equipment (>$5,000)', budgetTotals.equipment || 0],
      ['Travel', budgetTotals.travel || 0],
      ['Participant Support Costs', budgetTotals.participant_support || 0],
      ['Other Direct Costs', budgetTotals.other_direct || 0],
      ['Consortia/Subawards', budgetTotals.subawards || 0]
    ];
    
    // Calculate percentages and ensure they sum to 100%
    const percentages = [];
    let percentageSum = 0;
    
    categories.forEach(([name, amount], index) => {
      const percentage = totalDirect > 0 ? (amount / totalDirect) * 100 : 0;
      // Round to 2 decimal places, but keep the raw value for summing
      const roundedPercentage = parseFloat(percentage.toFixed(2));
      percentages.push({ name, amount, percentage: roundedPercentage, rawPercentage: percentage });
      percentageSum += percentage;
    });
    
    // Adjust the last percentage to ensure they sum to exactly 100%
    if (totalDirect > 0 && percentages.length > 0) {
      const adjustment = 100 - percentageSum;
      percentages[percentages.length - 1].percentage = parseFloat((percentages[percentages.length - 1].rawPercentage + adjustment).toFixed(2));
    }
    
    // Add rows with corrected percentages
    percentages.forEach(({ name, amount, percentage }) => {
      summaryData.push([name, formatCurrencyValue(amount), `${percentage.toFixed(2)}%`]);
    });
    
    summaryData.push(['']);
    summaryData.push(['TOTALS']);
    summaryData.push(['Total Direct Costs', formatCurrencyValue(totalDirect), '100.00%']);
    summaryData.push(['Indirect Costs (F&A @ 50.0%)', formatCurrencyValue(indirectCost), ((indirectCost / totalDirect) * 100).toFixed(2) + '%']);
    summaryData.push(['TOTAL PROJECT COST', formatCurrencyValue(totalProject), '']);
    
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for Summary sheet
    ws1['!cols'] = [
      { wch: 35 }, // Category column
      { wch: 20 }, // Amount column
      { wch: 25 }  // Percentage column
    ];
    
    // Format numeric cells in the Amount column (column B, starting from row 9)
    // Ensure all numeric values are properly typed
    const range = XLSX.utils.decode_range(ws1['!ref']);
    for (let R = 8; R <= range.e.r; R++) { // Start from row 9 (index 8) where data begins
      const cellAddress = XLSX.utils.encode_cell({ c: 1, r: R }); // Column B (index 1)
      if (ws1[cellAddress]) {
        const value = ws1[cellAddress].v;
        // Convert string numbers to actual numbers
        if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
          ws1[cellAddress].v = parseFloat(value);
          ws1[cellAddress].t = 'n';
        } else if (typeof value === 'number') {
          ws1[cellAddress].t = 'n';
        }
        // Set number format for currency
        if (ws1[cellAddress].t === 'n') {
          ws1[cellAddress].z = '#,##0.00';
        }
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    
    // Detailed Budget sheet if budgetData is available
    if (budgetData) {
      const detailedData = [
        ['DETAILED BUDGET BREAKDOWN BY YEAR'],
        [''],
        ['Proposal Title:', proposal?.title || 'Not specified'],
        ['Funding Source:', proposal?.agency || 'Not specified'],
        [''],
        ['Category', 'Item Description', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Total ($)', 'Notes']
      ];
      
      // Personnel
      if (budgetData.personnel) {
        detailedData.push(['PERSONNEL COMPENSATION', '', '', '', '', '', '', '', '']);
        if (budgetData.personnel.pi) {
          const pi = budgetData.personnel.pi;
          // Year values already have effort applied
          const piY1 = formatCurrencyValue(pi.y1);
          const piY2 = formatCurrencyValue(pi.y2);
          const piY3 = formatCurrencyValue(pi.y3);
          const piY4 = formatCurrencyValue(pi.y4);
          const piY5 = formatCurrencyValue(pi.y5);
          const piTotal = piY1 + piY2 + piY3 + piY4 + piY5;
          const hourlyInfo = pi.hourly_rate ? ` (Rate: $${pi.hourly_rate}/hr` + (pi.y1_hours ? `, Y1 Hours: ${pi.y1_hours})` : ')') : '';
          detailedData.push([
            '', 
            `Principal Investigator: ${pi.name || 'PI'}${hourlyInfo}`, 
            piY1, 
            piY2, 
            piY3, 
            piY4, 
            piY5, 
            piTotal, 
            pi.notes || ''
          ]);
        }
        if (budgetData.personnel.co_pis && budgetData.personnel.co_pis.length > 0) {
          budgetData.personnel.co_pis.forEach((coPi, idx) => {
            // Year values already have effort applied
            const coPiY1 = formatCurrencyValue(coPi.y1);
            const coPiY2 = formatCurrencyValue(coPi.y2);
            const coPiY3 = formatCurrencyValue(coPi.y3);
            const coPiY4 = formatCurrencyValue(coPi.y4);
            const coPiY5 = formatCurrencyValue(coPi.y5);
            const coPiTotal = coPiY1 + coPiY2 + coPiY3 + coPiY4 + coPiY5;
            const hourlyInfo = coPi.hourly_rate ? ` (Rate: $${coPi.hourly_rate}/hr` + (coPi.y1_hours ? `, Y1 Hours: ${coPi.y1_hours})` : ')') : '';
            detailedData.push([
              '', 
              `Co-Principal Investigator ${idx + 1}: ${coPi.name || 'Co-PI'}${hourlyInfo}`, 
              coPiY1, 
              coPiY2, 
              coPiY3, 
              coPiY4, 
              coPiY5, 
              coPiTotal, 
              coPi.notes || ''
            ]);
          });
        }
        // Add additional faculty members
        if (budgetData.personnel.faculty && budgetData.personnel.faculty.length > 0) {
          budgetData.personnel.faculty.forEach((faculty, idx) => {
            // Year values already have effort applied
            const facultyY1 = formatCurrencyValue(faculty.y1);
            const facultyY2 = formatCurrencyValue(faculty.y2);
            const facultyY3 = formatCurrencyValue(faculty.y3);
            const facultyY4 = formatCurrencyValue(faculty.y4);
            const facultyY5 = formatCurrencyValue(faculty.y5);
            const facultyTotal = facultyY1 + facultyY2 + facultyY3 + facultyY4 + facultyY5;
            const hourlyInfo = faculty.hourly_rate ? ` (Rate: $${faculty.hourly_rate}/hr` + (faculty.y1_hours ? `, Y1 Hours: ${faculty.y1_hours})` : ')') : '';
            detailedData.push([
              '', 
              `Faculty Member ${idx + 1}: ${faculty.name || 'Faculty'}${hourlyInfo}`, 
              facultyY1, 
              facultyY2, 
              facultyY3, 
              facultyY4, 
              facultyY5, 
              facultyTotal, 
              faculty.notes || ''
            ]);
          });
        }
      }
      
      // Other Personnel
      if (budgetData.other_personnel) {
        detailedData.push(['OTHER PERSONNEL', '', '', '', '', '', '', '', '']);
        Object.entries(budgetData.other_personnel).forEach(([key, person]) => {
          if (key === 'gras_ugrads' && Array.isArray(person)) {
            // Handle students array
            person.forEach((student, idx) => {
              // Year values already have effort applied
              const studentY1 = formatCurrencyValue(student.y1);
              const studentY2 = formatCurrencyValue(student.y2);
              const studentY3 = formatCurrencyValue(student.y3);
              const studentY4 = formatCurrencyValue(student.y4);
              const studentY5 = formatCurrencyValue(student.y5);
              const studentTotal = studentY1 + studentY2 + studentY3 + studentY4 + studentY5;
              const hourlyInfo = student.hourly_rate ? ` (Rate: $${student.hourly_rate}/hr` + (student.y1_hours ? `, Max Hours/Week: ${student.y1_hours})` : ')') : '';
              detailedData.push([
                '', 
                `GRAs/Undergraduates ${idx + 1}${hourlyInfo}`, 
                studentY1, 
                studentY2, 
                studentY3, 
                studentY4, 
                studentY5, 
                studentTotal, 
                student.notes || ''
              ]);
            });
          } else if (typeof person === 'object' && person !== null) {
            // Year values already have effort applied
            const personY1 = formatCurrencyValue(person.y1);
            const personY2 = formatCurrencyValue(person.y2);
            const personY3 = formatCurrencyValue(person.y3);
            const personY4 = formatCurrencyValue(person.y4);
            const personY5 = formatCurrencyValue(person.y5);
            const personTotal = personY1 + personY2 + personY3 + personY4 + personY5;
          let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (key === 'professional_staff') label = 'Professional Staff & Post Docs';
          if (key === 'temp_help') label = 'Temporary Help';
            const hourlyInfo = person.hourly_rate ? ` (Rate: $${person.hourly_rate}/hr` + (person.y1_hours ? `, Max Hours/Week: ${person.y1_hours})` : ')') : '';
          detailedData.push([
            '', 
            `${label}${hourlyInfo}`, 
              personY1, 
              personY2, 
              personY3, 
              personY4, 
              personY5, 
            personTotal, 
            person.notes || ''
          ]);
          }
        });
      }
      
      // Fringe Benefits (calculated automatically)
      if (budgetTotals.calculatedFringe) {
        detailedData.push(['FRINGE BENEFITS (Calculated Automatically)', '', '', '', '', '', '', '', '']);
        const fringeLabels = {
          faculty: 'Faculty',
          professional_staff: 'Professional Staff & Post Docs',
          gras_ugrads: 'GRAs/Undergraduates',
          temp_help: 'Temporary Help'
        };
        const multipliers = { faculty: 1.0, professional_staff: 1.33, gras_ugrads: 0.06, temp_help: 0.166 };
        Object.entries(budgetTotals.calculatedFringe).forEach(([key, fringe]) => {
          const fringeTotal = formatCurrencyValue(fringe.y1) + formatCurrencyValue(fringe.y2) + formatCurrencyValue(fringe.y3) + formatCurrencyValue(fringe.y4) + formatCurrencyValue(fringe.y5);
          const label = fringeLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          // Calculate year-specific rates
          const yearRates = [];
          ['y1', 'y2', 'y3', 'y4', 'y5'].forEach((yearKey, idx) => {
            const year = baseYear + idx;
            const baseFringeRate = getRateByYear('Fringe', year) || 0.31;
            const multiplier = multipliers[key];
            const yearRate = (baseFringeRate * multiplier * 100).toFixed(2) + '%';
            yearRates.push(yearRate);
          });
          
          // Show rates by year instead of averaging
          const rateDisplay = `Rates: Y1=${yearRates[0]}, Y2=${yearRates[1]}, Y3=${yearRates[2]}, Y4=${yearRates[3]}, Y5=${yearRates[4]}`;
          detailedData.push([
            '', 
            `${label} (${rateDisplay})`, 
            formatCurrencyValue(fringe.y1), 
            formatCurrencyValue(fringe.y2), 
            formatCurrencyValue(fringe.y3), 
            formatCurrencyValue(fringe.y4), 
            formatCurrencyValue(fringe.y5), 
            fringeTotal, 
            'Calculated automatically from salaries using year-specific rates'
          ]);
        });
      }
      
      // Equipment
      if (budgetData.equipment?.over_5k) {
        detailedData.push(['EQUIPMENT', '', '', '', '', '', '', '', '']);
        const eq = budgetData.equipment.over_5k;
        const eqTotal = formatCurrencyValue(eq.y1) + formatCurrencyValue(eq.y2) + formatCurrencyValue(eq.y3) + formatCurrencyValue(eq.y4) + formatCurrencyValue(eq.y5);
        detailedData.push([
          '', 
          'Equipment (>$5,000)', 
          formatCurrencyValue(eq.y1), 
          formatCurrencyValue(eq.y2), 
          formatCurrencyValue(eq.y3), 
          formatCurrencyValue(eq.y4), 
          formatCurrencyValue(eq.y5), 
          eqTotal, 
          eq.notes || ''
        ]);
      }
      
      // Travel
      if (budgetData.travel) {
        detailedData.push(['TRAVEL', '', '', '', '', '', '', '', '']);
        if (budgetData.travel.domestic) {
          const dom = budgetData.travel.domestic;
          const domTotal = formatCurrencyValue(dom.y1) + formatCurrencyValue(dom.y2) + formatCurrencyValue(dom.y3) + formatCurrencyValue(dom.y4) + formatCurrencyValue(dom.y5);
          detailedData.push([
            '', 
            'Domestic Travel', 
            formatCurrencyValue(dom.y1), 
            formatCurrencyValue(dom.y2), 
            formatCurrencyValue(dom.y3), 
            formatCurrencyValue(dom.y4), 
            formatCurrencyValue(dom.y5), 
            domTotal, 
            dom.notes || ''
          ]);
        }
        if (budgetData.travel.international) {
          const int = budgetData.travel.international;
          const intTotal = formatCurrencyValue(int.y1) + formatCurrencyValue(int.y2) + formatCurrencyValue(int.y3) + formatCurrencyValue(int.y4) + formatCurrencyValue(int.y5);
          detailedData.push([
            '', 
            'International Travel', 
            formatCurrencyValue(int.y1), 
            formatCurrencyValue(int.y2), 
            formatCurrencyValue(int.y3), 
            formatCurrencyValue(int.y4), 
            formatCurrencyValue(int.y5), 
            intTotal, 
            int.notes || ''
          ]);
        }
      }
      
      // Participant Support
      if (budgetData.participant_support?.nsf) {
        detailedData.push(['PARTICIPANT SUPPORT COSTS', '', '', '', '', '', '', '', '']);
        const psc = budgetData.participant_support.nsf;
        const pscTotal = formatCurrencyValue(psc.y1) + formatCurrencyValue(psc.y2) + formatCurrencyValue(psc.y3) + formatCurrencyValue(psc.y4) + formatCurrencyValue(psc.y5);
        detailedData.push([
          '', 
          'Participant Support Costs (NSF only)', 
          formatCurrencyValue(psc.y1), 
          formatCurrencyValue(psc.y2), 
          formatCurrencyValue(psc.y3), 
          formatCurrencyValue(psc.y4), 
          formatCurrencyValue(psc.y5), 
          pscTotal, 
          psc.notes || ''
        ]);
      }
      
      // Other Direct Costs
      if (budgetData.other_direct) {
        detailedData.push(['OTHER DIRECT COSTS', '', '', '', '', '', '', '', '']);
        const otherCosts = [
          { key: 'materials_supplies', label: 'Materials and Supplies' },
          { key: 'small_equipment', label: 'Small Equipment (<$5K)' },
          { key: 'publication', label: 'Publication Costs' },
          { key: 'computer_services', label: 'Computer Services' },
          { key: 'software', label: 'Software' },
          { key: 'facility_fees', label: 'Facility Usage Fees' },
          { key: 'conference_reg', label: 'Conference Registration' },
          { key: 'other1', label: 'Other (1)' },
          { key: 'other2', label: 'Other (2)' },
          { key: 'grad_tuition', label: 'Graduate Student Tuition & Health Insurance' }
        ];
        
        otherCosts.forEach(({ key, label }) => {
          const item = budgetData.other_direct[key];
          if (item) {
            const itemTotal = formatCurrencyValue(item.y1) + formatCurrencyValue(item.y2) + formatCurrencyValue(item.y3) + formatCurrencyValue(item.y4) + formatCurrencyValue(item.y5);
            detailedData.push([
              '', 
              label, 
              formatCurrencyValue(item.y1), 
              formatCurrencyValue(item.y2), 
              formatCurrencyValue(item.y3), 
              formatCurrencyValue(item.y4), 
              formatCurrencyValue(item.y5), 
              itemTotal, 
              item.notes || ''
            ]);
          }
        });
      }
      
      // Subawards
      if (budgetData.subawards && budgetData.subawards.length > 0) {
        detailedData.push(['CONSORTIA/SUBAWARDS', '', '', '', '', '', '', '', '']);
        budgetData.subawards.forEach((subaward, idx) => {
          const subTotal = formatCurrencyValue(subaward.y1) + formatCurrencyValue(subaward.y2) + formatCurrencyValue(subaward.y3) + formatCurrencyValue(subaward.y4) + formatCurrencyValue(subaward.y5);
          detailedData.push([
            '', 
            `Subaward ${idx + 1}: ${subaward.name || 'Unnamed Subaward'}`, 
            formatCurrencyValue(subaward.y1), 
            formatCurrencyValue(subaward.y2), 
            formatCurrencyValue(subaward.y3), 
            formatCurrencyValue(subaward.y4), 
            formatCurrencyValue(subaward.y5), 
            subTotal, 
            subaward.notes || ''
          ]);
        });
      }
      
      // Add totals row
      detailedData.push(['']);
      detailedData.push(['TOTALS', '', '', '', '', '', '', '', '']);
      detailedData.push(['Total Direct Costs', '', '', '', '', '', formatCurrencyValue(totalDirect), '']);
      detailedData.push(['Indirect Costs (F&A @ 50.0%)', '', '', '', '', '', formatCurrencyValue(indirectCost), '']);
      detailedData.push(['TOTAL PROJECT COST', '', '', '', '', '', formatCurrencyValue(totalProject), '']);
      
      const ws2 = XLSX.utils.aoa_to_sheet(detailedData);
      
      // Set column widths for Detailed Budget sheet
      ws2['!cols'] = [
        { wch: 25 }, // Category
        { wch: 45 }, // Item Description
        { wch: 12 }, // Y1
        { wch: 12 }, // Y2
        { wch: 12 }, // Y3
        { wch: 12 }, // Y4
        { wch: 12 }, // Y5
        { wch: 15 }, // Total
        { wch: 40 }  // Notes
      ];
      
      // Format numeric cells in year columns (columns C-G, index 2-6) and Total column (column H, index 7)
      const range2 = XLSX.utils.decode_range(ws2['!ref']);
      for (let R = 5; R <= range2.e.r; R++) { // Start from row 6 (index 5) where data begins
        // Format year columns (C-G, indices 2-6)
        for (let C = 2; C <= 6; C++) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          if (ws2[cellAddress]) {
            const value = ws2[cellAddress].v;
            // Convert string numbers to actual numbers
            if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
              ws2[cellAddress].v = parseFloat(value);
              ws2[cellAddress].t = 'n';
            } else if (typeof value === 'number') {
              ws2[cellAddress].t = 'n';
            }
            // Set number format for currency
            if (ws2[cellAddress].t === 'n') {
              ws2[cellAddress].z = '#,##0.00';
            }
          }
        }
        // Format Total column (H, index 7)
        const totalCellAddress = XLSX.utils.encode_cell({ c: 7, r: R });
        if (ws2[totalCellAddress]) {
          const value = ws2[totalCellAddress].v;
          // Convert string numbers to actual numbers
          if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
            ws2[totalCellAddress].v = parseFloat(value);
            ws2[totalCellAddress].t = 'n';
          } else if (typeof value === 'number') {
            ws2[totalCellAddress].t = 'n';
          }
          // Set number format for currency
          if (ws2[totalCellAddress].t === 'n') {
            ws2[totalCellAddress].z = '#,##0.00';
          }
        }
      }
      
      XLSX.utils.book_append_sheet(wb, ws2, 'Detailed Budget');
    }
    
    // Write file
    const fileName = `${(proposal?.title || 'Budget').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / totalDirect) * 100).toFixed(1);
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{margin: 0, fontWeight: 'bold'}}>{data.name}</p>
          <p style={{margin: '5px 0 0 0'}}>{formatCurrency(data.value)}</p>
          <p style={{margin: '5px 0 0 0', color: '#666'}}>{percentage}% of direct costs</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="step">
      <h2>Budget Summary</h2>
      
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        {proposal && (
          <div className="proposal-info" style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '4px',
            flex: 1,
            marginRight: '20px'
          }}>
            <h3 style={{margin: '0 0 10px 0'}}>{proposal.title || 'Proposal'}</h3>
            {proposal.agency && <p style={{margin: '5px 0', color: '#666'}}>Funding Source: {proposal.agency}</p>}
          </div>
        )}
        <button 
          onClick={exportToExcel}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          📥 Export to Excel
        </button>
      </div>

      <div className="budget-visualization" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px',
        marginBottom: '30px'
      }}>
        <div className="pie-chart-container" style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{marginTop: 0, marginBottom: '20px'}}>Budget Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={450}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={80}
                  wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }}
                  formatter={(value, entry) => {
                    const percentage = entry.payload && entry.payload.value ? 
                      ((entry.payload.value / totalDirect) * 100).toFixed(1) : '0.0';
                    return `${value} (${percentage}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{textAlign: 'center', color: '#666'}}>No budget data to display</p>
          )}
        </div>

        <div className="budget-summary-details" style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{marginTop: 0}}>Budget Totals</h3>
          <div className="budget-breakdown" style={{marginTop: '20px'}}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>Personnel:</strong></span>
              <span>{formatCurrency(budgetTotals.personnel || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>Fringe Benefits:</strong></span>
              <span>{formatCurrency(budgetTotals.fringe || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>Equipment:</strong></span>
              <span>{formatCurrency(budgetTotals.equipment || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>Travel:</strong></span>
              <span>{formatCurrency(budgetTotals.travel || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>Participant Support:</strong></span>
              <span>{formatCurrency(budgetTotals.participant_support || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span><strong>Other Direct Costs:</strong></span>
              <span>{formatCurrency(budgetTotals.other_direct || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '2px solid #333'
            }}>
              <span><strong>Subawards:</strong></span>
              <span>{formatCurrency(budgetTotals.subawards || 0)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '15px 0',
              borderBottom: '1px solid #eee',
              fontSize: '16px'
            }}>
              <span><strong>Total Direct Costs:</strong></span>
              <span><strong>{formatCurrency(totalDirect)}</strong></span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #eee'
            }}>
              <span>Indirect Costs (50.0%):</span>
              <span>{formatCurrency(indirectCost)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '15px 0',
              borderTop: '2px solid #333',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#f8f9fa',
              marginTop: '10px',
              borderRadius: '4px',
              paddingLeft: '10px',
              paddingRight: '10px'
            }}>
              <span>Total Project Cost:</span>
              <span>{formatCurrency(totalProject)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== PROPOSAL MANAGEMENT COMPONENTS ====================

function ProposalsDashboard() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const response = await axios.get('/api/proposals');
      setProposals(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setLoading(false);
    }
  };

  const handleDeleteProposal = async (proposalId, proposalTitle, e) => {
    e.stopPropagation(); // Prevent navigation when clicking delete button
    
    if (!window.confirm(`Are you sure you want to delete "${proposalTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/proposals/${proposalId}`);
      // Remove the proposal from the list
      setProposals(proposals.filter(p => p.proposal_id !== proposalId));
      alert('Proposal deleted successfully');
    } catch (error) {
      console.error('Error deleting proposal:', error);
      alert(`Error deleting proposal: ${error.response?.data?.error || error.message}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="step">
      <h2>My Research Proposals</h2>
      {proposals.length === 0 ? (
        <p>No proposals found. Create a new proposal to get started.</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {proposals.map(proposal => (
            <div
              key={proposal.proposal_id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: 'white',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                position: 'relative'
              }}
              onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{proposal.title}</h3>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    <strong>Agency:</strong> {proposal.agency || 'N/A'}
                  </p>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    <strong>PI:</strong> {proposal.first_name} {proposal.last_name}
                  </p>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    <strong>Duration:</strong> {proposal.total_duration_years} year(s)
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteProposal(proposal.proposal_id, proposal.title, e)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    marginLeft: '10px'
                  }}
                  title="Delete proposal"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalDetail() {
  const { proposalId } = useParams();
  const [proposal, setProposal] = useState(null);
  const [budget, setBudget] = useState(null);
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [personnelBudgets, setPersonnelBudgets] = useState({});
  const [budgetData, setBudgetData] = useState(null);
  const [budgetTotals, setBudgetTotals] = useState(null);
  const [rates, setRates] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRates();
    fetchProposalDetail();
  }, [proposalId]);

  const fetchRates = async () => {
    try {
      const response = await axios.get('/api/rates');
      setRates(response.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const fetchProposalDetail = async () => {
    try {
      const response = await axios.get(`/api/proposals/${proposalId}`);
      setProposal(response.data);
      if (response.data.budget_id) {
        // Fetch budget first to get budgetData
        await fetchBudget(response.data.budget_id);
        // Wait a bit to ensure budgetData state is set before fetching status
        await new Promise(resolve => setTimeout(resolve, 100));
        // Fetch status (but it won't overwrite totals if budgetData exists)
        await fetchBudgetStatus(response.data.budget_id);
        await fetchPersonnel(response.data.budget_id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching proposal:', error);
      setLoading(false);
    }
  };

  const fetchPersonnel = async (budgetId) => {
    try {
      // Fetch personnel from the proposal
      const personnelResponse = await axios.get(`/api/proposals/${proposalId}/personnel`);
      const personnelData = personnelResponse.data || [];
      setPersonnel(personnelData);
      
      // Fetch budget lines for each personnel member
      if (budgetId && personnelData.length > 0) {
        const budgetLinesResponse = await axios.get(`/api/budgets/${budgetId}/approved-lines`);
        const budgetLines = budgetLinesResponse.data || [];
        
        // Map budget lines to personnel by matching notes
        const personnelBudgetMap = {};
        
        personnelData.forEach(person => {
          const fullName = `${person.first_name} ${person.last_name}`;
          const lastName = person.last_name;
          const firstName = person.first_name;
          
          // Find matching budget lines based on role and name patterns
          const matchingLines = budgetLines.filter(line => {
            if (!line.notes) return false;
            const notes = line.notes.toLowerCase();
            const nameLower = fullName.toLowerCase();
            const lastNameLower = lastName.toLowerCase();
            const firstNameLower = firstName.toLowerCase();
            
            // Match based on role and name patterns
            if (person.role === 'PI') {
              // PI lines typically start with "PI:" or contain "PI: Name"
              return (notes.includes('pi:') || notes.startsWith('pi')) && 
                     (notes.includes(nameLower) || notes.includes(lastNameLower));
            } else if (person.role === 'Co-PI') {
              // Co-PI lines contain "Co-PI" and the name
              return notes.includes('co-pi') && 
                     (notes.includes(nameLower) || notes.includes(lastNameLower));
            } else if (person.role === 'Senior_Personnel') {
              // Faculty lines contain "Faculty" and the name
              return notes.includes('faculty') && 
                     (notes.includes(nameLower) || notes.includes(lastNameLower));
            }
            return false;
          });
          
          if (matchingLines.length > 0) {
            personnelBudgetMap[person.user_id] = {
              approved: matchingLines.reduce((sum, line) => sum + parseFloat(line.approved_amount || 0), 0),
              committed: matchingLines.reduce((sum, line) => sum + parseFloat(line.committed_amount || 0), 0),
              spent: matchingLines.reduce((sum, line) => sum + parseFloat(line.spent_amount || 0), 0),
              remaining: matchingLines.reduce((sum, line) => {
                const approved = parseFloat(line.approved_amount || 0);
                const committed = parseFloat(line.committed_amount || 0);
                const spent = parseFloat(line.spent_amount || 0);
                return sum + (approved - committed - spent);
              }, 0)
            };
          } else {
            // If no matching lines found, set to 0
            personnelBudgetMap[person.user_id] = {
              approved: 0,
              committed: 0,
              spent: 0,
              remaining: 0
            };
          }
        });
        
        setPersonnelBudgets(personnelBudgetMap);
      }
    } catch (error) {
      console.error('Error fetching personnel:', error);
    }
  };

  const fetchBudget = async (budgetId) => {
    try {
      const response = await axios.get(`/api/budgets/${budgetId}`);
      setBudget(response.data);

      // Use stored budget_data if available (preferred)
      if (response.data && response.data.budget_data) {
        const budgetDataObj = response.data.budget_data;
        setBudgetData(budgetDataObj);
        // Always recalculate totals from budgetData when available
        const recalculatedTotals = recalculateTotalsFromBudgetData(budgetDataObj);
        if (recalculatedTotals) {
          setBudgetTotals(recalculatedTotals);
        }
      }
      // Otherwise, reconstruct budgetData from budget items if available
      else if (response.data && response.data.items && response.data.items.length > 0) {
        reconstructBudgetDataFromItems(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  };

  const reconstructBudgetDataFromItems = (items) => {
    // Initialize budget data structure
    const reconstructed = {
      personnel: {
        pi: { name: proposal?.first_name + ' ' + proposal?.last_name || '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        co_pis: [],
        faculty: []
      },
      other_personnel: {
        professional_staff: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        gras_ugrads: [],
        temp_help: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      equipment: {
        over_5k: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      travel: {
        domestic: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        international: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      participant_support: {
        nsf: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      other_direct: {
        materials_supplies: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        small_equipment: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        publication: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        computer_services: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        software: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        facility_fees: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        conference_reg: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        other1: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        other2: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        student_tuition: []
      },
      subawards: []
    };

    // Process items and populate budgetData
    items.forEach(item => {
      const year = item.year || 1;
      const yearKey = `y${year}`;
      const amount = parseFloat(item.amount || 0);

      if (year >= 1 && year <= 5 && yearKey) {
        switch (item.item_type) {
          case 'Salary':
            // Map to personnel based on person_type and person_id
            if (item.person_type === 'Faculty' && item.person_id === proposal?.pi_id) {
              reconstructed.personnel.pi[yearKey] = amount.toString();
            } else if (item.person_type === 'Faculty') {
              // Check if it's a Co-PI or additional faculty
              const existingCoPi = reconstructed.personnel.co_pis.find(cp => cp.user_id === item.person_id);
              if (existingCoPi) {
                existingCoPi[yearKey] = amount.toString();
              } else {
                // Check if this person already exists in co_pis
                let existingPerson = reconstructed.personnel.co_pis.find(cp => cp.user_id === item.person_id);
                if (existingPerson) {
                  existingPerson[yearKey] = amount.toString();
                } else {
                  // Add as new Co-PI or faculty
                  const name = item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : '';
                  const newPerson = {
                    user_id: item.person_id,
                    name: name,
                    y1: '',
                    y2: '',
                    y3: '',
                    y4: '',
                    y5: '',
                    notes: ''
                  };
                  newPerson[yearKey] = amount.toString();
                  reconstructed.personnel.co_pis.push(newPerson);
                }
              }
            } else if (item.person_type === 'Staff_Postdoc') {
              reconstructed.other_personnel.professional_staff[yearKey] = 
                (parseFloat(reconstructed.other_personnel.professional_staff[yearKey] || 0) + amount).toString();
            } else if (item.person_type === 'Student') {
              // Check if this student already exists
              let existingStudent = reconstructed.other_personnel.gras_ugrads.find(s => s.student_id === item.person_id);
              if (existingStudent) {
                existingStudent[yearKey] = amount.toString();
              } else {
                // Add to gras_ugrads
                const newStudent = {
                  student_id: item.person_id,
                  y1: '',
                  y2: '',
                  y3: '',
                  y4: '',
                  y5: '',
                  notes: ''
                };
                newStudent[yearKey] = amount.toString();
                reconstructed.other_personnel.gras_ugrads.push(newStudent);
              }
            }
            break;
          case 'Equipment':
            reconstructed.equipment.over_5k[yearKey] = 
              (parseFloat(reconstructed.equipment.over_5k[yearKey] || 0) + amount).toString();
            break;
          case 'Travel':
            // Try to determine if domestic or international from description
            const desc = (item.description || '').toLowerCase();
            if (desc.includes('international') || desc.includes('foreign')) {
              reconstructed.travel.international[yearKey] = 
                (parseFloat(reconstructed.travel.international[yearKey] || 0) + amount).toString();
            } else {
              reconstructed.travel.domestic[yearKey] = 
                (parseFloat(reconstructed.travel.domestic[yearKey] || 0) + amount).toString();
            }
            break;
          case 'Tuition':
            // Check if this student tuition already exists
            let existingTuition = reconstructed.other_direct.student_tuition.find(t => t.student_id === item.person_id);
            if (existingTuition) {
              existingTuition[yearKey] = amount.toString();
            } else {
              const newTuition = {
                student_id: item.person_id,
                y1: '',
                y2: '',
                y3: '',
                y4: '',
                y5: '',
                notes: ''
              };
              newTuition[yearKey] = amount.toString();
              reconstructed.other_direct.student_tuition.push(newTuition);
            }
            break;
          case 'Supplies':
          case 'Other':
            // Map to other_direct categories based on description
            const description = (item.description || '').toLowerCase();
            if (description.includes('supply') || description.includes('material')) {
              reconstructed.other_direct.materials_supplies[yearKey] = 
                (parseFloat(reconstructed.other_direct.materials_supplies[yearKey] || 0) + amount).toString();
            } else {
              reconstructed.other_direct.other1[yearKey] = 
                (parseFloat(reconstructed.other_direct.other1[yearKey] || 0) + amount).toString();
            }
            break;
        }
      }
    });

    setBudgetData(reconstructed);
    // Always recalculate totals from reconstructed budgetData
    const recalculatedTotals = recalculateTotalsFromBudgetData(reconstructed);
    if (recalculatedTotals) {
      setBudgetTotals(recalculatedTotals);
    }
  };

  // Effect to recalculate totals whenever budgetData changes or when Budget Summary tab is opened
  useEffect(() => {
    if (budgetData && Object.keys(budgetData).length > 0 && rates.length > 0) {
      const recalculatedTotals = recalculateTotalsFromBudgetData(budgetData);
      if (recalculatedTotals) {
        setBudgetTotals(recalculatedTotals);
      }
    } else {
      // If no budgetData and we have budgetStatus, use that as fallback
      if (budgetStatus && budgetStatus.by_category && budgetStatus.by_category.length > 0) {
        calculateBudgetTotalsFromStatus(budgetStatus);
      }
    }
  }, [budgetData, activeTab, budgetStatus, rates]);

  const fetchBudgetStatus = async (budgetId, retryCount = 0) => {
    try {
      const response = await axios.get(`/api/budgets/${budgetId}/budget-status`);
      setBudgetStatus(response.data);


      // If no budget lines found and we haven't retried yet, try to initialize them
      if (response.data && (!response.data.by_category || response.data.by_category.length === 0) && retryCount === 0) {
        try {
          // Try to initialize - backend will handle checking if budget has total_amount
          await axios.post(`/api/budgets/${budgetId}/initialize-approved-lines`);
          // Refetch after initialization
          await fetchBudgetStatus(budgetId, 1);
        } catch (initError) {
          // If initialization fails (e.g., already exists or no total), that's okay
        }
      }
    } catch (error) {
      console.error('Error fetching budget status:', error);
      setBudgetStatus({ error: error.message, by_category: [], individual_faculty: [], totals: {} });
    }
  };


  // Recalculate budget totals from budgetData (same logic as ProposalStep)
  const recalculateTotalsFromBudgetData = (data) => {
    if (!data) {
      return null;
    }

    let totals = {
      personnel: 0,
      fringe: 0,
      equipment: 0,
      travel: 0,
      participant_support: 0,
      other_direct: 0,
      subawards: 0,
      direct_costs: 0,
      fa_overhead: 0,
      total: 0
    };

    // Calculate PI total (year values already have effort applied)
    if (data.personnel && data.personnel.pi) {
      const pi = data.personnel.pi;
      const piTotal = (parseFloat(pi.y1) || 0) + (parseFloat(pi.y2) || 0) + (parseFloat(pi.y3) || 0) + (parseFloat(pi.y4) || 0) + (parseFloat(pi.y5) || 0);
      totals.personnel += piTotal;
    }

    // Calculate Co-PIs totals (year values already have effort applied)
    if (data.personnel && data.personnel.co_pis) {
      data.personnel.co_pis.forEach(coPi => {
        totals.personnel += (parseFloat(coPi.y1) || 0) + (parseFloat(coPi.y2) || 0) + (parseFloat(coPi.y3) || 0) + (parseFloat(coPi.y4) || 0) + (parseFloat(coPi.y5) || 0);
      });
    }

    // Calculate additional faculty totals (year values already have effort applied)
    if (data.personnel && data.personnel.faculty) {
      data.personnel.faculty.forEach(faculty => {
        totals.personnel += (parseFloat(faculty.y1) || 0) + (parseFloat(faculty.y2) || 0) + (parseFloat(faculty.y3) || 0) + (parseFloat(faculty.y4) || 0) + (parseFloat(faculty.y5) || 0);
      });
    }

    // Calculate other personnel (year values already have effort applied)
    if (data.other_personnel) {
      Object.entries(data.other_personnel).forEach(([key, person]) => {
        if (key === 'gras_ugrads' && Array.isArray(person)) {
          person.forEach(student => {
            totals.personnel += (parseFloat(student.y1) || 0) + (parseFloat(student.y2) || 0) + (parseFloat(student.y3) || 0) + (parseFloat(student.y4) || 0) + (parseFloat(student.y5) || 0);
          });
        } else if (typeof person === 'object' && person !== null) {
          totals.personnel += (parseFloat(person.y1) || 0) + (parseFloat(person.y2) || 0) + (parseFloat(person.y3) || 0) + (parseFloat(person.y4) || 0) + (parseFloat(person.y5) || 0);
        }
      });
    }

    // Calculate equipment, travel, participant support, other direct, subawards (same as ProposalStep)
    if (data.equipment && data.equipment.over_5k) {
      totals.equipment += (parseFloat(data.equipment.over_5k.y1) || 0) + (parseFloat(data.equipment.over_5k.y2) || 0) + (parseFloat(data.equipment.over_5k.y3) || 0) + (parseFloat(data.equipment.over_5k.y4) || 0) + (parseFloat(data.equipment.over_5k.y5) || 0);
    }

    if (data.travel) {
      if (data.travel.domestic) {
        totals.travel += (parseFloat(data.travel.domestic.y1) || 0) + (parseFloat(data.travel.domestic.y2) || 0) + (parseFloat(data.travel.domestic.y3) || 0) + (parseFloat(data.travel.domestic.y4) || 0) + (parseFloat(data.travel.domestic.y5) || 0);
      }
      if (data.travel.international) {
        totals.travel += (parseFloat(data.travel.international.y1) || 0) + (parseFloat(data.travel.international.y2) || 0) + (parseFloat(data.travel.international.y3) || 0) + (parseFloat(data.travel.international.y4) || 0) + (parseFloat(data.travel.international.y5) || 0);
      }
    }

    if (data.participant_support && data.participant_support.nsf) {
      totals.participant_support += (parseFloat(data.participant_support.nsf.y1) || 0) + (parseFloat(data.participant_support.nsf.y2) || 0) + (parseFloat(data.participant_support.nsf.y3) || 0) + (parseFloat(data.participant_support.nsf.y4) || 0) + (parseFloat(data.participant_support.nsf.y5) || 0);
    }

    if (data.other_direct) {
      Object.entries(data.other_direct).forEach(([key, item]) => {
        if (key === 'student_tuition' && Array.isArray(item)) {
          item.forEach(tuition => {
            totals.other_direct += (parseFloat(tuition.y1) || 0) + (parseFloat(tuition.y2) || 0) + (parseFloat(tuition.y3) || 0) + (parseFloat(tuition.y4) || 0) + (parseFloat(tuition.y5) || 0);
          });
        } else if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          totals.other_direct += (parseFloat(item.y1) || 0) + (parseFloat(item.y2) || 0) + (parseFloat(item.y3) || 0) + (parseFloat(item.y4) || 0) + (parseFloat(item.y5) || 0);
        }
      });
    }

    if (data.subawards) {
      data.subawards.forEach(subaward => {
        totals.subawards += (parseFloat(subaward.y1) || 0) + (parseFloat(subaward.y2) || 0) + (parseFloat(subaward.y3) || 0) + (parseFloat(subaward.y4) || 0) + (parseFloat(subaward.y5) || 0);
      });
    }

    // Calculate fringe automatically from salaries 
    // Fringe rates multipliers: Faculty = 1.0x, Professional Staff = 1.33x, Students = 0.06x, Temp Help = 0.166x
    const fringeMultipliers = {
      faculty: 1.0,
      professional_staff: 1.33,
      gras_ugrads: 0.06,
      temp_help: 0.166
    };

    // Initialize salary totals by person type and year
    const salaryByTypeAndYear = {
      faculty: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      professional_staff: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      gras_ugrads: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      temp_help: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 }
    };

    const baseYear = 2024;

    // Helper function to get rate by year from the rates array
    const getRateByYear = (rateType, year) => {
      const rate = rates.find(r => r.rate_type === rateType && r.year === year);
      return rate ? parseFloat(rate.rate_amount) : null;
    };

    // Sum PI salaries by year 
    if (data.personnel && data.personnel.pi) {
      const pi = data.personnel.pi;
      // Fringe is calculated on effort-adjusted salary 
      salaryByTypeAndYear.faculty.y1 += (parseFloat(pi.y1) || 0);
      salaryByTypeAndYear.faculty.y2 += (parseFloat(pi.y2) || 0);
      salaryByTypeAndYear.faculty.y3 += (parseFloat(pi.y3) || 0);
      salaryByTypeAndYear.faculty.y4 += (parseFloat(pi.y4) || 0);
      salaryByTypeAndYear.faculty.y5 += (parseFloat(pi.y5) || 0);
    }

    // Sum Co-PI salaries by year 
    if (data.personnel && data.personnel.co_pis) {
      data.personnel.co_pis.forEach(coPi => {
        // Fringe is calculated on effort-adjusted salary 
        salaryByTypeAndYear.faculty.y1 += (parseFloat(coPi.y1) || 0);
        salaryByTypeAndYear.faculty.y2 += (parseFloat(coPi.y2) || 0);
        salaryByTypeAndYear.faculty.y3 += (parseFloat(coPi.y3) || 0);
        salaryByTypeAndYear.faculty.y4 += (parseFloat(coPi.y4) || 0);
        salaryByTypeAndYear.faculty.y5 += (parseFloat(coPi.y5) || 0);
      });
    }

    // Sum additional faculty salaries by year
    if (data.personnel && data.personnel.faculty) {
      data.personnel.faculty.forEach(faculty => {
        // Fringe is calculated on effort-adjusted salary
        salaryByTypeAndYear.faculty.y1 += (parseFloat(faculty.y1) || 0);
        salaryByTypeAndYear.faculty.y2 += (parseFloat(faculty.y2) || 0);
        salaryByTypeAndYear.faculty.y3 += (parseFloat(faculty.y3) || 0);
        salaryByTypeAndYear.faculty.y4 += (parseFloat(faculty.y4) || 0);
        salaryByTypeAndYear.faculty.y5 += (parseFloat(faculty.y5) || 0);
      });
    }

    // Sum professional staff salaries by year 
    if (data.other_personnel && data.other_personnel.professional_staff) {
      const profStaff = data.other_personnel.professional_staff;
      salaryByTypeAndYear.professional_staff.y1 += (parseFloat(profStaff.y1) || 0);
      salaryByTypeAndYear.professional_staff.y2 += (parseFloat(profStaff.y2) || 0);
      salaryByTypeAndYear.professional_staff.y3 += (parseFloat(profStaff.y3) || 0);
      salaryByTypeAndYear.professional_staff.y4 += (parseFloat(profStaff.y4) || 0);
      salaryByTypeAndYear.professional_staff.y5 += (parseFloat(profStaff.y5) || 0);
    }

    // Sum student (GRAs/UGrads) salaries by year
    if (data.other_personnel && Array.isArray(data.other_personnel.gras_ugrads)) {
      data.other_personnel.gras_ugrads.forEach(student => {
        salaryByTypeAndYear.gras_ugrads.y1 += (parseFloat(student.y1) || 0);
        salaryByTypeAndYear.gras_ugrads.y2 += (parseFloat(student.y2) || 0);
        salaryByTypeAndYear.gras_ugrads.y3 += (parseFloat(student.y3) || 0);
        salaryByTypeAndYear.gras_ugrads.y4 += (parseFloat(student.y4) || 0);
        salaryByTypeAndYear.gras_ugrads.y5 += (parseFloat(student.y5) || 0);
      });
    }

    // Sum temp help salaries by year 
    if (data.other_personnel && data.other_personnel.temp_help) {
      const tempHelp = data.other_personnel.temp_help;
      salaryByTypeAndYear.temp_help.y1 += (parseFloat(tempHelp.y1) || 0);
      salaryByTypeAndYear.temp_help.y2 += (parseFloat(tempHelp.y2) || 0);
      salaryByTypeAndYear.temp_help.y3 += (parseFloat(tempHelp.y3) || 0);
      salaryByTypeAndYear.temp_help.y4 += (parseFloat(tempHelp.y4) || 0);
      salaryByTypeAndYear.temp_help.y5 += (parseFloat(tempHelp.y5) || 0);
    }

    // Calculate fringe for each person type and year using year-specific rates
    const calculatedFringe = {
      faculty: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      professional_staff: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      gras_ugrads: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
      temp_help: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 }
    };

    // Calculate fringe for each year and person type
    ['y1', 'y2', 'y3', 'y4', 'y5'].forEach(yearKey => {
      const yearIndex = parseInt(yearKey.substring(1)) - 1;
      const year = baseYear + yearIndex;
      const baseFringeRate = getRateByYear('Fringe', year) || 0.31; // Default to 31% if not found

      Object.keys(fringeMultipliers).forEach(personType => {
        const salary = salaryByTypeAndYear[personType][yearKey];
        const multiplier = fringeMultipliers[personType];
        const fringeRate = baseFringeRate * multiplier;
        calculatedFringe[personType][yearKey] = salary * fringeRate;
        totals.fringe += calculatedFringe[personType][yearKey];
      });
    });

    // Store calculated fringe in totals for export/display
    totals.calculatedFringe = calculatedFringe;

    // Calculate direct costs
    totals.direct_costs = totals.personnel + totals.fringe + totals.equipment + totals.travel + 
                         totals.participant_support + totals.other_direct + totals.subawards;
    
    // F&A is 50% of total direct costs
    totals.fa_overhead = totals.direct_costs * 0.5;
    totals.total = totals.direct_costs + totals.fa_overhead;

    return totals;
  };

  const calculateBudgetTotalsFromStatus = (status) => {
    if (!status || !status.by_category) {
      setBudgetTotals(null);
      return;
    }

    // Map cost categories to budget total categories
    const categoryMap = {
      'PERSONNEL': 'personnel',
      'FRINGE': 'fringe',
      'EQUIPMENT': 'equipment',
      'TRAVEL': 'travel',
      'PARTICIPANT_SUPPORT': 'participant_support',
      'OTHER': 'other_direct',
      'SUBAWARD': 'subawards'
    };

    const totals = {
      personnel: 0,
      fringe: 0,
      equipment: 0,
      travel: 0,
      participant_support: 0,
      other_direct: 0,
      subawards: 0,
      direct_costs: 0,
      fa_overhead: 0,
      total: 0
    };

    // Sum up approved amounts by category
    status.by_category.forEach(cat => {
      const categoryKey = categoryMap[cat.cost_category] || 'other_direct';
      totals[categoryKey] = parseFloat(cat.total_approved || 0);
    });

    // Calculate direct costs
    totals.direct_costs = totals.personnel + totals.fringe + totals.equipment + totals.travel + 
                         totals.participant_support + totals.other_direct + totals.subawards;

    // F&A is 50% of total direct costs
    totals.fa_overhead = totals.direct_costs * 0.5;
    totals.total = totals.direct_costs + totals.fa_overhead;

    setBudgetTotals(totals);

    // Only create minimal budgetData structure if budgetData hasn't been set yet
    
    if (!budgetData || Object.keys(budgetData).length === 0 || 
        (budgetData.personnel && budgetData.personnel.pi && budgetData.personnel.pi.y1 === '')) {
      // Create minimal budgetData structure for display
      const minimalBudgetData = {
        personnel: {
        pi: { name: proposal?.first_name + ' ' + proposal?.last_name || '', y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        co_pis: [],
        faculty: []
      },
      other_personnel: {
        professional_staff: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        gras_ugrads: [],
        temp_help: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      equipment: {
        over_5k: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      travel: {
        domestic: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        international: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      participant_support: {
        nsf: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' }
      },
      other_direct: {
        materials_supplies: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        small_equipment: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        publication: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        computer_services: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        software: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        facility_fees: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        conference_reg: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        other1: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        other2: { y1: '', y2: '', y3: '', y4: '', y5: '', notes: '' },
        student_tuition: []
      },
      subawards: []
      };

      setBudgetData(minimalBudgetData);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Calculate chartData - must be before early returns
  const chartData = useMemo(() => {
    if (!budgetStatus || !budgetStatus.by_category) {
      return [];
    }
    const filtered = budgetStatus.by_category.filter(cat =>
      parseFloat(cat.total_approved || 0) > 0 ||
      parseFloat(cat.total_committed || 0) > 0 ||
      parseFloat(cat.total_spent || 0) > 0
    );
    const categoryData = filtered.map(cat => ({
      name: cat.cost_category,
      approved: parseFloat(cat.total_approved || 0),
      committed: parseFloat(cat.total_committed || 0),
      spent: parseFloat(cat.total_spent || 0),
      remaining: parseFloat(cat.remaining || 0)
    }));
    
    // Add personnel data if available
    if (budgetTotals && budgetTotals.personnel > 0) {
      // Find SALARY category for committed/spent/remaining
      const salaryCategory = budgetStatus.by_category.find(cat => cat.cost_category === 'SALARY');
      const personnelData = {
        name: 'Personnel',
        approved: parseFloat(budgetTotals.personnel || 0),
        committed: salaryCategory ? parseFloat(salaryCategory.total_committed || 0) : 0,
        spent: salaryCategory ? parseFloat(salaryCategory.total_spent || 0) : 0,
        remaining: salaryCategory ? parseFloat(salaryCategory.remaining || 0) : parseFloat(budgetTotals.personnel || 0)
      };
      // Add personnel at the beginning of the array
      categoryData.unshift(personnelData);
    }
    
    return categoryData;
  }, [budgetStatus, budgetTotals]);

  if (loading) return <div>Loading...</div>;
  if (!proposal) return <div>Proposal not found</div>;

  return (
    <div className="step">
      <button onClick={() => navigate('/proposals')} className="back-button">
        ← Back to Proposals
      </button>
      <h2>{proposal.title}</h2>
      
      <div className="tab-container">
        <button
          onClick={() => setActiveTab('overview')}
          className={activeTab === 'overview' ? 'tab-button tab-button-active' : 'tab-button tab-button-inactive'}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={activeTab === 'budget' ? 'tab-button tab-button-active' : 'tab-button tab-button-inactive'}
        >
          Budget Status
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={activeTab === 'transactions' ? 'tab-button tab-button-active' : 'tab-button tab-button-inactive'}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('personnel')}
          className={activeTab === 'personnel' ? 'tab-button tab-button-active' : 'tab-button tab-button-inactive'}
        >
          Personnel
        </button>
        <button
          onClick={() => setActiveTab('budget-summary')}
          className={activeTab === 'budget-summary' ? 'tab-button tab-button-active' : 'tab-button tab-button-inactive'}
        >
          Budget Summary
        </button>
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="grid-2-col">
            <div className="info-card">
              <h3>Proposal Information</h3>
              <p><strong>Agency:</strong> {proposal.agency || 'N/A'}</p>
              <p><strong>Duration:</strong> {proposal.total_duration_years} year(s)</p>
              <p><strong>Total Budget:</strong> {formatCurrency(budget?.total_amount || 0)}</p>
            </div>
            <div className="info-card">
              <h3>Principal Investigator</h3>
              <p><strong>PI:</strong> {proposal.first_name} {proposal.last_name}</p>
            </div>
          </div>
          {budget?.budget_id && (
            <div className="margin-top-20">
              <button
                onClick={() => navigate(`/transactions?budget_id=${budget.budget_id}`)}
                className="request-transaction-button"
              >
                + Request New Transaction
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'budget' && (
        <div>
          <h3>Budget Status by Category</h3>
          
          {!budgetStatus ? (
            <p>Loading budget status...</p>
          ) : budgetStatus.error ? (
            <div className="error-message">
              <strong>Error:</strong> {budgetStatus.error}
            </div>
          ) : (
            <>
              {/* Individual Faculty Members Section */}
              {budgetStatus.individual_faculty && budgetStatus.individual_faculty.length > 0 && (
                <div className="chart-container">
                  <h4>Individual Faculty Members</h4>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Faculty Member</th>
                        <th className="text-right">Approved</th>
                        <th className="text-right">Committed</th>
                        <th className="text-right">Spent</th>
                        <th className="text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetStatus.individual_faculty.map((faculty, idx) => (
                        <tr key={idx}>
                          <td className="bold">
                            {faculty.notes?.replace('PI: ', '').replace(/^Co-PI \d+: /, '').replace(/^Faculty \d+: /, '') || 'Faculty Member'}
                          </td>
                          <td className="text-right">
                            {formatCurrency(faculty.approved_amount || 0)}
                          </td>
                          <td className="text-right">
                            {formatCurrency(faculty.committed_amount || 0)}
                          </td>
                          <td className="text-right">
                            {formatCurrency(faculty.spent_amount || 0)}
                          </td>
                          <td className="text-right bold">
                            {formatCurrency(faculty.remaining || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {chartData && chartData.length > 0 ? (
                <div className="chart-container">
                  <h4>Budget Status Chart</h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="approved" fill="#8884d8" name="Approved" />
                      <Bar dataKey="committed" fill="#82ca9d" name="Committed" />
                      <Bar dataKey="spent" fill="#ffc658" name="Spent" />
                      <Bar dataKey="remaining" fill="#ff7300" name="Remaining" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="info-message">
                  <p>No chart data available. Chart will appear when budget lines have values.</p>
                  <p>
                    Debug: chartData length = {chartData?.length || 0}, 
                    by_category length = {budgetStatus?.by_category?.length || 0}
                  </p>
                </div>
              )}
            </>
          )}
          
          {budgetStatus && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Approved</th>
                  <th className="text-right">Committed</th>
                  <th className="text-right">Spent</th>
                  <th className="text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {budgetTotals && budgetTotals.personnel > 0 && (
                  <tr className="personnel-row">
                    <td className="bold">Personnel</td>
                    <td className="text-right">
                      {formatCurrency(budgetTotals.personnel || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(
                        budgetStatus.by_category?.find(cat => cat.cost_category === 'SALARY')?.total_committed || 0
                      )}
                    </td>
                    <td className="text-right">
                      {formatCurrency(
                        budgetStatus.by_category?.find(cat => cat.cost_category === 'SALARY')?.total_spent || 0
                      )}
                    </td>
                    <td className="text-right bold">
                      {formatCurrency(
                        budgetStatus.by_category?.find(cat => cat.cost_category === 'SALARY')?.remaining || 
                        (budgetTotals.personnel || 0)
                      )}
                    </td>
                  </tr>
                )}
                {budgetStatus.by_category && budgetStatus.by_category.length > 0 ? (
                  budgetStatus.by_category.map((cat, idx) => (
                    <tr key={idx}>
                      <td>{cat.cost_category}</td>
                      <td className="text-right">
                        {formatCurrency(cat.total_approved || 0)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(cat.total_committed || 0)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(cat.total_spent || 0)}
                      </td>
                      <td className="text-right bold">
                        {formatCurrency(cat.remaining || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      <div>
                        <p>No approved budget lines found. Budget totals may not have been set up yet.</p>
                        {budget?.budget_id && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await axios.post(`/api/budgets/${budget.budget_id}/initialize-approved-lines`);
                                if (response.data.success) {
                                  // Refetch budget status
                                  await fetchBudgetStatus(budget.budget_id, 1);
                                  alert('Budget lines initialized successfully!');
                                } else {
                                  alert(response.data.message || 'Initialization completed');
                                  await fetchBudgetStatus(budget.budget_id, 1);
                                }
                              } catch (error) {
                                console.error('Error initializing:', error);
                                const errorMsg = error.response?.data?.error || error.message || 'Failed to initialize approved budget lines';
                                alert('Error: ' + errorMsg);
                                // Still try to refetch in case it worked
                                await fetchBudgetStatus(budget.budget_id, 1);
                              }
                            }}
                            className="init-button"
                          >
                            Initialize Budget Lines
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {budgetStatus.totals && (() => {
                // Calculate Personnel values
                const personnelApproved = budgetTotals && budgetTotals.personnel > 0 ? parseFloat(budgetTotals.personnel) : 0;
                const salaryCategory = budgetStatus.by_category?.find(cat => cat.cost_category === 'SALARY');
                const salaryApproved = salaryCategory ? parseFloat(salaryCategory.total_approved || 0) : 0;
                
                // Total approved: start with existing total, subtract SALARY, add Personnel
                
                const totalApproved = (budgetStatus.totals.total_approved || 0) - salaryApproved + personnelApproved;
                const totalCommitted = budgetStatus.totals.total_committed || 0;
                const totalSpent = budgetStatus.totals.total_spent || 0;
                const totalRemaining = totalApproved - totalCommitted - totalSpent;
                
                return (
                  <tfoot>
                    <tr>
                      <td>TOTAL</td>
                      <td className="text-right">
                        {formatCurrency(totalApproved)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(totalCommitted)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(totalSpent)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(totalRemaining)}
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          )}
        </div>
      )}

      {activeTab === 'transactions' && budget?.budget_id && (
        <TransactionsView budgetId={budget.budget_id} />
      )}

      {activeTab === 'personnel' && (
        <div>
          <h3>Grant Personnel</h3>
          <PersonnelView 
            proposalId={proposalId} 
            budgetData={budgetData}
            proposal={proposal}
            personnelBudgets={personnelBudgets}
          />
        </div>
      )}

      {activeTab === 'budget-summary' && (
        <div>
          {budgetTotals && budgetData ? (
            <BudgetStep 
              budget={budget} 
              budgetTotals={budgetTotals} 
              proposal={proposal} 
              budgetData={budgetData} 
            />
          ) : (
            <div className="step">
              <h2>Budget Summary</h2>
              <p>Loading budget data...</p>
              {!budget && (
                <p>No budget found for this proposal. Budget summary will be available once budget data is loaded.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonnelView({ proposalId, budgetData, proposal, personnelBudgets }) {
  const [personnel, setPersonnel] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPersonnel();
    fetchStudents();
  }, [proposalId]);

  const fetchPersonnel = async () => {
    try {
      const response = await axios.get(`/api/proposals/${proposalId}/personnel`);
      setPersonnel(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching personnel:', error);
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const calculateTotal = (person) => {
    const y1 = parseFloat(person.y1 || 0);
    const y2 = parseFloat(person.y2 || 0);
    const y3 = parseFloat(person.y3 || 0);
    const y4 = parseFloat(person.y4 || 0);
    const y5 = parseFloat(person.y5 || 0);
    const effort = parseFloat(person.effort_percentage || 100) / 100;
    return (y1 + y2 + y3 + y4 + y5) * effort;
  };

  const getStudentName = (studentId) => {
    if (!studentId) return 'N/A';
    const student = students.find(s => s.student_id === parseInt(studentId));
    return student ? `${student.first_name} ${student.last_name}` : `Student ID: ${studentId}`;
  };

  if (loading) return <div>Loading...</div>;

  const hasData = budgetData && (
    (budgetData.personnel && (budgetData.personnel.pi || budgetData.personnel.co_pis?.length > 0 || budgetData.personnel.faculty?.length > 0)) ||
    (budgetData.other_personnel && (
      budgetData.other_personnel.professional_staff ||
      (budgetData.other_personnel.gras_ugrads && budgetData.other_personnel.gras_ugrads.length > 0) ||
      budgetData.other_personnel.temp_help
    ))
  );

  if (!hasData && personnel.length === 0) {
    return <p>No personnel assigned to this proposal.</p>;
  }

  return (
    <div>
      {/* Principal Investigator */}
      {budgetData?.personnel?.pi && (
        <div style={{ marginBottom: '30px' }}>
          <h4 style={{ marginBottom: '10px', color: '#007bff' }}>Principal Investigator</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e8e8e8' }}>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Name</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Y1</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Y2</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Y3</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Y4</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Y5</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                  {budgetData.personnel.pi.name || (proposal ? `${proposal.first_name} ${proposal.last_name}` : 'PI')}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                  {formatCurrency(budgetData.personnel.pi.y1 || 0)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                  {formatCurrency(budgetData.personnel.pi.y2 || 0)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                  {formatCurrency(budgetData.personnel.pi.y3 || 0)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                  {formatCurrency(budgetData.personnel.pi.y4 || 0)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                  {formatCurrency(budgetData.personnel.pi.y5 || 0)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>
                  {formatCurrency(calculateTotal(budgetData.personnel.pi))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Co-Principal Investigators */}
      {budgetData?.personnel?.co_pis && budgetData.personnel.co_pis.length > 0 && (
        <div className="personnel-section">
          <h4 className="copi">Co-Principal Investigators</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Y1</th>
                <th className="text-right">Y2</th>
                <th className="text-right">Y3</th>
                <th className="text-right">Y4</th>
                <th className="text-right">Y5</th>
                <th className="text-right bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {budgetData.personnel.co_pis.map((coPi, idx) => {
                const matchingPersonnel = personnel.find(p => p.user_id === parseInt(coPi.user_id));
                return (
                  <tr key={idx}>
                    <td>
                      {coPi.name || (matchingPersonnel ? `${matchingPersonnel.first_name} ${matchingPersonnel.last_name}` : `Co-PI ${idx + 1}`)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(coPi.y1 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(coPi.y2 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(coPi.y3 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(coPi.y4 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(coPi.y5 || 0)}
                    </td>
                    <td className="text-right bold">
                      {formatCurrency(calculateTotal(coPi))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Additional Faculty */}
      {budgetData?.personnel?.faculty && budgetData.personnel.faculty.length > 0 && (
        <div className="personnel-section">
          <h4 className="faculty">Additional Faculty</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Y1</th>
                <th className="text-right">Y2</th>
                <th className="text-right">Y3</th>
                <th className="text-right">Y4</th>
                <th className="text-right">Y5</th>
                <th className="text-right bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {budgetData.personnel.faculty.map((faculty, idx) => {
                const matchingPersonnel = personnel.find(p => p.user_id === parseInt(faculty.user_id));
                return (
                  <tr key={idx}>
                    <td>
                      {faculty.name || (matchingPersonnel ? `${matchingPersonnel.first_name} ${matchingPersonnel.last_name}` : `Faculty ${idx + 1}`)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(faculty.y1 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(faculty.y2 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(faculty.y3 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(faculty.y4 || 0)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(faculty.y5 || 0)}
                    </td>
                    <td className="text-right bold">
                      {formatCurrency(calculateTotal(faculty))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Professional Staff & Post Docs */}
      {budgetData?.other_personnel?.professional_staff && (
        <div className="personnel-section">
          <h4 className="staff">Professional Staff & Post Docs</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Y1</th>
                <th className="text-right">Y2</th>
                <th className="text-right">Y3</th>
                <th className="text-right">Y4</th>
                <th className="text-right">Y5</th>
                <th className="text-right bold">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {budgetData.other_personnel.professional_staff.name || 'Professional Staff'}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.professional_staff.y1 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.professional_staff.y2 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.professional_staff.y3 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.professional_staff.y4 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.professional_staff.y5 || 0)}
                </td>
                <td className="text-right bold">
                  {formatCurrency(calculateTotal(budgetData.other_personnel.professional_staff))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* GRAs/Undergraduates */}
      {budgetData?.other_personnel?.gras_ugrads && Array.isArray(budgetData.other_personnel.gras_ugrads) && budgetData.other_personnel.gras_ugrads.length > 0 && (
        <div className="personnel-section">
          <h4 className="students">GRAs/Undergraduates</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Y1</th>
                <th className="text-right">Y2</th>
                <th className="text-right">Y3</th>
                <th className="text-right">Y4</th>
                <th className="text-right">Y5</th>
                <th className="text-right bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {budgetData.other_personnel.gras_ugrads.map((student, idx) => (
                <tr key={idx}>
                  <td>
                    {getStudentName(student.student_id)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(student.y1 || 0)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(student.y2 || 0)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(student.y3 || 0)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(student.y4 || 0)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(student.y5 || 0)}
                  </td>
                  <td className="text-right bold">
                    {formatCurrency(calculateTotal(student))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      {budgetData?.other_personnel?.temp_help && (
        <div className="personnel-section">
          <h4 className="temp-help">Temporary Help</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Y1</th>
                <th className="text-right">Y2</th>
                <th className="text-right">Y3</th>
                <th className="text-right">Y4</th>
                <th className="text-right">Y5</th>
                <th className="text-right bold">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {budgetData.other_personnel.temp_help.name || 'Temporary Help'}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.temp_help.y1 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.temp_help.y2 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.temp_help.y3 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.temp_help.y4 || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(budgetData.other_personnel.temp_help.y5 || 0)}
                </td>
                <td className="text-right bold">
                  {formatCurrency(calculateTotal(budgetData.other_personnel.temp_help))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Fallback: Show basic personnel list if no budgetData */}
      {!hasData && personnel.length > 0 && (
        <div className="margin-top-20">
          <h4>Personnel List</h4>
          <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        {personnel.map((person, idx) => (
          <tr key={idx}>
            <td>
              {person.first_name} {person.last_name}
            </td>
            <td>{person.role}</td>
            <td>{person.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
        </div>
      )}
    </div>
  );
}

function TransactionsView({ budgetId: propBudgetId, proposalId: propProposalId }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [costCategories, setCostCategories] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState(propBudgetId || null);
  const [selectedProposalId, setSelectedProposalId] = useState(propProposalId || null);
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const urlBudgetId = searchParams.get('budget_id');
  const urlProposalId = searchParams.get('proposal_id');

  useEffect(() => {
    if (urlBudgetId) {
      setSelectedBudgetId(parseInt(urlBudgetId));
    }
    if (urlProposalId) {
      setSelectedProposalId(parseInt(urlProposalId));
    }
    fetchProposals();
    fetchCostCategories();
    fetchTransactions();
  }, [selectedBudgetId, selectedProposalId, urlBudgetId, urlProposalId]);

  const fetchProposals = async () => {
    try {
      const response = await axios.get('/api/proposals');
      setProposals(response.data);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    }
  };

  const fetchCostCategories = async () => {
    try {
      const response = await axios.get('/api/federal-cost-categories');
      setCostCategories(response.data);
    } catch (error) {
      console.error('Error fetching cost categories:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = {};
      if (selectedBudgetId) params.budget_id = selectedBudgetId;
      if (selectedProposalId) params.proposal_id = selectedProposalId;
      const response = await axios.get('/api/transactions', { params });
      setTransactions(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
    }
  };

  const handleSubmitTransaction = async (transactionData) => {
    try {
      await axios.post('/api/transactions', transactionData);
      setShowForm(false);
      fetchTransactions();
      alert('Transaction request submitted successfully!');
    } catch (error) {
      if (error.response?.data?.validation_errors) {
        alert('Validation errors:\n' + error.response.data.validation_errors.join('\n'));
      } else {
        alert('Error submitting transaction: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return '#28a745';
      case 'Rejected': return '#dc3545';
      case 'Pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Transaction Requests</h2>
        <div>
          <select
            value={selectedProposalId || ''}
            onChange={(e) => {
              const propId = e.target.value ? parseInt(e.target.value) : null;
              setSelectedProposalId(propId);
              // Find budget_id for this proposal
              const proposal = proposals.find(p => p.proposal_id === propId);
              if (proposal && proposal.budget_id) {
                setSelectedBudgetId(proposal.budget_id);
              }
            }}
            style={{ marginRight: '10px', padding: '8px' }}
          >
            <option value="">All Proposals</option>
            {proposals.map(proposal => (
              <option key={proposal.proposal_id} value={proposal.proposal_id}>
                {proposal.title} - {proposal.agency || 'N/A'}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + New Transaction Request
          </button>
        </div>
      </div>

      {showForm && (
        <TransactionRequestForm
          proposals={proposals}
          costCategories={costCategories}
          onSubmit={handleSubmitTransaction}
          onCancel={() => setShowForm(false)}
          defaultBudgetId={selectedBudgetId}
        />
      )}

      {transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
              <tr style={{ backgroundColor: '#e8e8e8' }}>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Date</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Proposal</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Category</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Description</th>
                <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Amount</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Requested By</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(trans => (
                <tr key={trans.transaction_id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {new Date(trans.transaction_date || trans.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {trans.proposal_title || 'N/A'}
                  </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{trans.cost_category}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{trans.description}</td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                  {formatCurrency(trans.amount)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: getStatusColor(trans.status),
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {trans.status}
                  </span>
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  {trans.requester_first} {trans.requester_last}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TransactionRequestForm({ proposals, costCategories, onSubmit, onCancel, defaultBudgetId }) {
  const [formData, setFormData] = useState({
    budget_id: defaultBudgetId || '',
    cost_category: '',
    amount: '',
    description: '',
    vendor: '',
    transaction_date: new Date().toISOString().split('T')[0],
    requested_by: 1 
  });
  const [selectedProposalId, setSelectedProposalId] = useState('');

  const handleProposalChange = (proposalId) => {
    setSelectedProposalId(proposalId);
    const proposal = proposals.find(p => p.proposal_id === parseInt(proposalId));
    if (proposal && proposal.budget_id) {
      setFormData({ ...formData, budget_id: proposal.budget_id });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      backgroundColor: '#f8f9fa'
    }}>
      <h3>New Transaction Request</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Proposal *
          </label>
          <select
            value={selectedProposalId}
            onChange={(e) => handleProposalChange(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value="">Select a proposal</option>
            {proposals.map(proposal => (
              <option key={proposal.proposal_id} value={proposal.proposal_id}>
                {proposal.title} - {proposal.agency || 'N/A'}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Cost Category *
          </label>
          <select
            value={formData.cost_category}
            onChange={(e) => setFormData({ ...formData, cost_category: e.target.value })}
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value="">Select a category</option>
            {costCategories.map(cat => (
              <option key={cat.category_id} value={cat.category_code}>
                {cat.category_name} {!cat.is_allowable && '(Unallowable)'}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Amount ($) *
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            rows="3"
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Vendor (if applicable)
          </label>
          <input
            type="text"
            value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Transaction Date *
          </label>
          <input
            type="date"
            value={formData.transaction_date}
            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminTransactionsView() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('Pending'); // Default to show pending
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [budgetStatusMap, setBudgetStatusMap] = useState({}); // Map of budget_id -> { category -> remaining }

  useEffect(() => {
    fetchTransactions();
  }, [filterStatus]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = filterStatus ? { status: filterStatus } : {};
      const response = await axios.get('/api/transactions', { params });
      setTransactions(response.data);
      
      // Fetch budget status for all unique budget_ids
      await fetchBudgetStatusForTransactions(response.data);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
    }
  };

  const fetchBudgetStatusForTransactions = async (transactionsData) => {
    try {
      // Get unique budget_ids from transactions
      const budgetIds = [...new Set(transactionsData
        .map(t => t.budget_id)
        .filter(id => id !== null && id !== undefined))];

      // Fetch budget status for each budget_id
      const statusMap = {};
      for (const budgetId of budgetIds) {
        try {
          const response = await axios.get(`/api/budgets/${budgetId}/budget-status`);
          if (response.data && response.data.by_category) {
            // Create a map of category -> remaining for this budget
            const categoryMap = {};
            response.data.by_category.forEach(cat => {
              categoryMap[cat.cost_category] = parseFloat(cat.remaining || 0);
            });
            statusMap[budgetId] = categoryMap;
          }
        } catch (error) {
          console.error(`Error fetching budget status for budget ${budgetId}:`, error);
        }
      }
      
      setBudgetStatusMap(statusMap);
    } catch (error) {
      console.error('Error fetching budget statuses:', error);
    }
  };

  const getRemainingForCategory = (budgetId, costCategory) => {
    if (!budgetId || !costCategory) return null;
    const budgetStatus = budgetStatusMap[budgetId];
    if (!budgetStatus) return null;
    return budgetStatus[costCategory] !== undefined ? budgetStatus[costCategory] : null;
  };

  const handleApprove = async (transactionId) => {
    if (!window.confirm('Are you sure you want to approve this transaction?')) {
      return;
    }

    try {
      
      await axios.put(`/api/transactions/${transactionId}`, {
        status: 'Approved',
        approved_by: 1
      });
      alert('Transaction approved successfully!');
      // Refresh transactions and budget status
      await fetchTransactions();
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert(`Error approving transaction: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleReject = async (transactionId, reason) => {
    if (!reason || reason.trim() === '') {
      alert('Please provide a rejection reason.');
      return;
    }

    try {
      await axios.put(`/api/transactions/${transactionId}`, {
        status: 'Rejected',
        approved_by: 1,
        rejection_reason: reason
      });
      alert('Transaction rejected successfully!');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedTransaction(null);
      // Refresh transactions and budget status
      await fetchTransactions();
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      alert(`Error rejecting transaction: ${error.response?.data?.error || error.message}`);
    }
  };

  const openRejectModal = (transaction) => {
    setSelectedTransaction(transaction);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return '#28a745';
      case 'Rejected': return '#dc3545';
      case 'Pending': return '#ffc107';
      case 'Cancelled': return '#6c757d';
      default: return '#6c757d';
    }
  };

  if (loading) return <div className="step">Loading...</div>;

  return (
    <div className="step">
      <h2>Admin - Transaction Management</h2>
      
      <div className="filter-section">
        <label className="filter-label">Filter by Status:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">All Transactions</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {transactions.length === 0 ? (
        <p>No {filterStatus ? filterStatus.toLowerCase() : ''} transactions found.</p>
      ) : (
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Proposal</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Remaining Funds</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(trans => (
                <tr key={trans.transaction_id}>
                  <td>
                    {new Date(trans.transaction_date || trans.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {trans.proposal_title || 'N/A'}
                  </td>
                  <td>{trans.cost_category}</td>
                  <td>{trans.description}</td>
                  <td>{trans.vendor || 'N/A'}</td>
                  <td className="text-right">
                    {formatCurrency(trans.amount)}
                  </td>
                  <td className="text-right">
                    {(() => {
                      const remaining = getRemainingForCategory(trans.budget_id, trans.cost_category);
                      if (remaining === null) return 'N/A';
                      const className = remaining < 0 ? 'remaining-funds over' : remaining < parseFloat(trans.amount) ? 'remaining-funds low' : 'remaining-funds';
                      return (
                        <span className={className}>
                          {formatCurrency(remaining)}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`status-badge-wrapper status-badge-${trans.status.toLowerCase()}`} style={{ backgroundColor: getStatusColor(trans.status) }}>
                      {trans.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {trans.requester_first} {trans.requester_last}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {trans.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => handleApprove(trans.transaction_id)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectModal(trans)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {trans.status === 'Rejected' && trans.rejection_reason && (
                      <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                        Reason: {trans.rejection_reason}
                      </div>
                    )}
                    {trans.status === 'Approved' && trans.approver_first && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        Approved by: {trans.approver_first} {trans.approver_last}
                        {trans.approved_at && (
                          <div>{new Date(trans.approved_at).toLocaleDateString()}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedTransaction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>Reject Transaction</h3>
            <p><strong>Amount:</strong> {formatCurrency(selectedTransaction.amount)}</p>
            <p><strong>Description:</strong> {selectedTransaction.description}</p>
            <p><strong>Category:</strong> {selectedTransaction.cost_category}</p>
            
            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedTransaction(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedTransaction.transaction_id, rejectionReason)}
                disabled={!rejectionReason || rejectionReason.trim() === ''}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: rejectionReason && rejectionReason.trim() !== '' ? 'pointer' : 'not-allowed',
                  opacity: rejectionReason && rejectionReason.trim() !== '' ? 1 : 0.6
                }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddEntryModal({ onClose, onSuccess }) {
  const [entryType, setEntryType] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const response = await axios.get('/api/institutions');
      setInstitutions(response.data || []);
    } catch (error) {
      console.error('Error fetching institutions:', error);
    }
  };

  const resetForm = () => {
    setFormData({});
    setError('');
  };

  const handleEntryTypeChange = (type) => {
    setEntryType(type);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let endpoint = '';
      let data = {};

      switch (entryType) {
        case 'PI':
        case 'Co-PI':
        case 'Faculty':
          endpoint = '/api/users';
          data = {
            username: formData.username,
            email: formData.email,
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: entryType === 'Faculty' ? 'Co-PI' : entryType, // Faculty uses Co-PI role
            institution_id: formData.institution_id || null
          };
          break;
        case 'Student':
          endpoint = '/api/students';
          data = {
            student_number: formData.student_number || null,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email || null,
            student_type: formData.student_type,
            residency_status: formData.residency_status,
            program: formData.program || null,
            enrollment_status: formData.enrollment_status || 'Full_Time',
            start_date: formData.start_date || null,
            expected_graduation_date: formData.expected_graduation_date || null,
            is_active: formData.is_active !== undefined ? formData.is_active : true
          };
          break;
        case 'University':
          endpoint = '/api/institutions';
          data = {
            name: formData.name,
            fa_rate: parseFloat(formData.fa_rate) || 50.00
          };
          break;
        default:
          setError('Please select an entry type');
          setLoading(false);
          return;
      }

      const response = await axios.post(endpoint, data);
      if (response.data.success) {
        alert(`${entryType} added successfully!`);
        onSuccess();
      }
    } catch (error) {
      console.error('Error adding entry:', error);
      setError(error.response?.data?.error || error.message || 'Failed to add entry');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (entryType) {
      case 'PI':
      case 'Co-PI':
      case 'Faculty':
        return (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Username <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Email <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                First Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Last Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Institution (Optional)
              </label>
              <select
                value={formData.institution_id || ''}
                onChange={(e) => setFormData({ ...formData, institution_id: e.target.value || null })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="">-- Select Institution (Optional) --</option>
                {institutions.map(inst => (
                  <option key={inst.institution_id} value={inst.institution_id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        );

      case 'Student':
        return (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Student Number (Optional)
              </label>
              <input
                type="text"
                value={formData.student_number || ''}
                onChange={(e) => setFormData({ ...formData, student_number: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                First Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Last Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Student Type <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={formData.student_type || ''}
                onChange={(e) => setFormData({ ...formData, student_type: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="">-- Select Student Type --</option>
                <option value="Graduate_Student">Graduate Student</option>
                <option value="Undergraduate">Undergraduate</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Residency Status <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={formData.residency_status || ''}
                onChange={(e) => setFormData({ ...formData, residency_status: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="">-- Select Residency Status --</option>
                <option value="In_State">In-State</option>
                <option value="Out_Of_State">Out-of-State</option>
                <option value="International">International</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Program (Optional)
              </label>
              <input
                type="text"
                value={formData.program || ''}
                onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Enrollment Status
              </label>
              <select
                value={formData.enrollment_status || 'Full_Time'}
                onChange={(e) => setFormData({ ...formData, enrollment_status: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="Full_Time">Full-Time</option>
                <option value="Part_Time">Part-Time</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Start Date (Optional)
              </label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Expected Graduation Date (Optional)
              </label>
              <input
                type="date"
                value={formData.expected_graduation_date || ''}
                onChange={(e) => setFormData({ ...formData, expected_graduation_date: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </>
        );

      case 'University':
        return (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                University Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                F&A Rate (%) <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.fa_rate || '50.00'}
                onChange={(e) => setFormData({ ...formData, fa_rate: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <small style={{ color: '#666' }}>Enter as percentage (e.g., 50.00 for 50%)</small>
            </div>
          </>
        );

      default:
        return <p>Please select an entry type above.</p>;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Add New Entry to Database</h2>
          <button
            onClick={onClose}
            className="close-button"
          >
            ×
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">
            Entry Type <span className="required">*</span>
          </label>
          <select
            value={entryType}
            onChange={(e) => handleEntryTypeChange(e.target.value)}
            className="form-select"
          >
            <option value="">-- Select Entry Type --</option>
            <option value="PI">Principal Investigator (PI)</option>
            <option value="Co-PI">Co-Principal Investigator (Co-PI)</option>
            <option value="Faculty">Faculty Member</option>
            <option value="Student">Student</option>
            <option value="University">University/Institution</option>
          </select>
        </div>

        {entryType && (
          <form onSubmit={handleSubmit}>
            {renderForm()}

            {error && (
              <div className="error-message" style={{ padding: '10px', marginBottom: '15px' }}>
                {error}
              </div>
            )}

            <div className="form-actions-row">
              <button
                type="submit"
                disabled={loading}
                className="submit-button"
                style={{ flex: 1, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Adding...' : 'Add Entry'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;
