import React, { useState } from 'react';
import '../css/apply.css';
import '../css/header.css';
import '../css/footer.css';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import images from '../utils/tbsImages';
import Header from '../components/headerviews/HeaderApply'
const states = [
  { abbreviation: 'AL', name: 'Alabama' },
  { abbreviation: 'AK', name: 'Alaska' },
  { abbreviation: 'AZ', name: 'Arizona' },
  { abbreviation: 'AR', name: 'Arkansas' },
  { abbreviation: 'CA', name: 'California' },
  { abbreviation: 'CO', name: 'Colorado' },
  { abbreviation: 'CT', name: 'Connecticut' },
  { abbreviation: 'DE', name: 'Delaware' },
  { abbreviation: 'FL', name: 'Florida' },
  { abbreviation: 'GA', name: 'Georgia' },
  { abbreviation: 'HI', name: 'Hawaii' },
  { abbreviation: 'ID', name: 'Idaho' },
  { abbreviation: 'IL', name: 'Illinois' },
  { abbreviation: 'IN', name: 'Indiana' },
  { abbreviation: 'IA', name: 'Iowa' },
  { abbreviation: 'KS', name: 'Kansas' },
  { abbreviation: 'KY', name: 'Kentucky' },
  { abbreviation: 'LA', name: 'Louisiana' },
  { abbreviation: 'ME', name: 'Maine' },
  { abbreviation: 'MD', name: 'Maryland' },
  { abbreviation: 'MA', name: 'Massachusetts' },
  { abbreviation: 'MI', name: 'Michigan' },
  { abbreviation: 'MN', name: 'Minnesota' },
  { abbreviation: 'MS', name: 'Mississippi' },
  { abbreviation: 'MO', name: 'Missouri' },
  { abbreviation: 'MT', name: 'Montana' },
  { abbreviation: 'NE', name: 'Nebraska' },
  { abbreviation: 'NV', name: 'Nevada' },
  { abbreviation: 'NH', name: 'New Hampshire' },
  { abbreviation: 'NJ', name: 'New Jersey' },
  { abbreviation: 'NM', name: 'New Mexico' },
  { abbreviation: 'NY', name: 'New York' },
  { abbreviation: 'NC', name: 'North Carolina' },
  { abbreviation: 'ND', name: 'North Dakota' },
  { abbreviation: 'OH', name: 'Ohio' },
  { abbreviation: 'OK', name: 'Oklahoma' },
  { abbreviation: 'OR', name: 'Oregon' },
  { abbreviation: 'PA', name: 'Pennsylvania' },
  { abbreviation: 'RI', name: 'Rhode Island' },
  { abbreviation: 'SC', name: 'South Carolina' },
  { abbreviation: 'SD', name: 'South Dakota' },
  { abbreviation: 'TN', name: 'Tennessee' },
  { abbreviation: 'TX', name: 'Texas' },
  { abbreviation: 'UT', name: 'Utah' },
  { abbreviation: 'VT', name: 'Vermont' },
  { abbreviation: 'VA', name: 'Virginia' },
  { abbreviation: 'WA', name: 'Washington' },
  { abbreviation: 'WV', name: 'West Virginia' },
  { abbreviation: 'WI', name: 'Wisconsin' },
  { abbreviation: 'WY', name: 'Wyoming' }
];
const startMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]
const endMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]
const misdemeanorCharges = [
  "Speeding Ticket",
  "Failure to Appear",
  "DUI",
  "Hit and Run(Property Damage)",
  "Reckless Driving",
  "Driving with a Suspended/Revoked License",
  "Driving without insurance",
  "Driving with an expired registration/license",
  "Public Intoxication",
  "Disorderly Conduct",
  "Trespassing",
  "Vandalism",
  "Simple Assault",
  "Simple Stalking",
  "Petty Theft",
  "Prostitution",
  "Possession of Small Amounts of Controlled Substances",
  "Other (Please Explain the Misdemeanor)",
];

const felonyCharges = [
  "Murder",
  "Attempted Murder",
  "Manslaughter",
  "Hit and Run(DUI, Caused Injury, or Death)",
  "Domestic Violence",
  "Criminal Damage to Property",
  "Possession of Controlled Substances(Felony Conviction)",
  "Failure to Register as a Sex Offender",
  "Aggravated Assault/Battery",
  "Aggravated Stalking",
  "Child Molestation",
  "Child Pornography",
  "Child Endangerment",
  "Extortion",
  "Sexual Assault",
  "Illegal Possession of Firearm",
  "Kidnapping",
  "Drug Trafficking",
  "Arson",
  "Embezzlement",
  "Identity Theft",
  "Money Laundering",
  "Burglary",
  "Robbery",
  "Parole Violation",
  "Other (Please Explain the Felony)",
];

const selectLanguages = [
  {name: "English(Inglés)", disabled: false},
  {name: "Spanish(Español)", disabled: false},
  {name: "Both(English & Spanish)", disabled: false}
]
const Apply = () => {
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [school, setSchool] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');
  const [addedEd, setAddedEd] = useState([]);
  const [workError, setWorkError] = useState(""); // Yes or No selection
  const [educationError, setEducationError] = useState(""); // Yes or No selection
  const [backgroundError, setBackgroundError] = useState(""); 
  const [convictions, setConvictions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newConviction, setNewConviction] = useState({
    type: "Misdemeanor",
    charge: "",
    date: "",
    explanation: "",
  });
  const [employmentEntries, setEmploymentEntries] = useState([]);
  const [newEmploy, setNewEmploy] = useState({
  employerName: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  duties: "",
  currentlyEmployed: false,
  reasonForLeaving: "",
  mayContact: "",
});
  const [wantsDriver, setWantsDriver] = useState('');
  const [drivingRecord, setDrivingRecord] = useState({ speedingTickets: '', trafficViolations: '', duis: '', otherViolations: '' });
  const [data, formData] = useState({
    first: '',
    last: '',
    email: '',
    phone: '',
    education: '',
    position: '',
    location: '',
    background: '',
    languages: '',
    skills: '',
    workHistory: '',
    resume: '',
    cover: '',
    message: ''
  });
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionErrorMessage, setSubmissionErrorMessage] = useState('');

  const toggleMenu = () => {
    setIsNavOpen(!isNavOpen);
};
      const handleAdminClick = () => {
        if (isAdmin) {
            // Logging out
            localStorage.removeItem('adminUser');
            setIsAdmin(false);
            navigate('/admin-login');
        } else {
            // Navigate to login
            navigate('/admin-login');
        }
    };
const handleAddEducation = () => {
  let isValid = true;

  if (!school) {
    setErrors((prevErrors) => ({ ...prevErrors, school: "School name is required" }));
    isValid = false;
  }
  if (!startMonth) {
    setErrors((prevErrors) => ({ ...prevErrors, startMonth: "Start month is required" }));
    isValid = false;
  }
  if (!startYear) {
    setErrors((prevErrors) => ({ ...prevErrors, startYear: "Start year is required" }));
    isValid = false;
  }
  if (!endMonth) {
    setErrors((prevErrors) => ({ ...prevErrors, endMonth: "End month is required" }));
    isValid = false;
  }
  if (!endYear) {
    setErrors((prevErrors) => ({ ...prevErrors, endYear: "End year is required" }));
    isValid = false;
  }

  if (!isValid) return;

  setAddedEd([...addedEd, { school, startMonth, startYear, endMonth, endYear }]);
  setSubmissionErrorMessage(""); // Remove error after successful addition
  // ✅ Clear the "Education is Required" error once an entry is added
  setEducationError("");

  // Clear input fields
  setSchool("");
  setStartMonth("");
  setStartYear("");
  setEndMonth("");
  setEndYear("");
};


const handleRemoveEducation = (index) => {
  if (addedEd.length > 1) {
    setAddedEd(addedEd.filter((_, i) => i !== index));
  }
};

const addConviction = () => {
  if (!newConviction.charge || !newConviction.date || !newConviction.explanation) {
    setBackgroundError("Please fill in all background fields before adding.");
    return;
  }

  setConvictions([...convictions, newConviction]);

  // Clear the new conviction input fields
  setNewConviction({
    type: "Misdemeanor",
    charge: "",
    date: "",
    explanation: "",
  });
  setSubmissionErrorMessage(""); // Remove error after successful addition
  // ✅ Remove error once a background entry is added
  setBackgroundError("");
};

const removeConviction = (index) => {
  setConvictions((prev) => {
    const updatedConvictions = prev.filter((_, i) => i !== index);
    return updatedConvictions;
  });

  // ✅ If the user removes all convictions, re-trigger the error if "Yes" is selected
  if (convictions.length === 1) {
    setBackgroundError("Background is required.");
  }
};
const handleBackgroundChange = (event) => {
  const value = event.target.value;
  formData({ ...data, background: value });

  if (value === "No") {
    setConvictions([]); // Clear convictions if "No" is selected
    setBackgroundError(""); // ✅ Remove error if user selects "No"
  } else {
    setConvictions([]); // Reset convictions for "Yes"
    setBackgroundError(""); // ✅ Remove error message
  }
};

const addEmploymentEntry = () => {
  // Validate fields before adding
  if (
    !newEmploy.employerName ||
    !newEmploy.address ||
    !newEmploy.city ||
    !newEmploy.state ||
    !newEmploy.zip ||
    !newEmploy.phone ||
    !newEmploy.duties ||
    (!newEmploy.currentlyEmployed && !newEmploy.reasonForLeaving) ||
    !newEmploy.mayContact
  ) {
    setWorkError("Please fill in all employment fields before adding.");
    return;
  }

  // Add new employment entry to the list
  setEmploymentEntries((prevEntries) => {
    const updatedEntries = [...prevEntries, newEmploy];
    return updatedEntries;
  });

  // Reset form fields for the next entry
  setNewEmploy({
    employerName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    duties: "",
    currentlyEmployed: false,
    reasonForLeaving: "",
    mayContact: "",
  });
  setSubmissionErrorMessage(""); // Remove error after successful addition
  setWorkError(""); // Remove error after successful addition
};

const handleEmploymentChange = (event) => {
  const value = event.target.value;
  formData({ ...data, workHistory: value });

  if (value === "No") {
    setEmploymentEntries([]); // ✅ Clear employment entries when "No" is selected
    setWorkError(""); // ✅ Remove error if user selects "No"
  } else {
    setEmploymentEntries([]); // ✅ Reset employment for "Yes"
    setWorkError(""); // ✅ Remove error message
  }
};


const handleEmployment2Change = (field, value) => {
  let formattedValue = value;

  // Format Phone Number as (000) 000-0000
  if (field === "phone") {
    const rawDigits = value.replace(/\D/g, ""); // Remove non-numeric characters

    if (rawDigits.length <= 10) {
      formattedValue = rawDigits.replace(
        /(\d{3})(\d{3})(\d{4})/,
        "($1) $2-$3"
      );
    }
  }

  // Ensure ZIP Code is exactly 5 digits
  if (field === "zip") {
    const rawDigits = value.replace(/\D/g, ""); // Remove non-numeric characters
    formattedValue = rawDigits.slice(0, 5); // Limit to 5 digits
  }

  setNewEmploy((prev) => ({
    ...prev,
    [field]: formattedValue,
  }));
};



  // Function to remove an employment entry
  const removeEmploymentEntry = (index) => {
    setEmploymentEntries((prevEntries) => {
      const updatedEntries = prevEntries.filter((_, i) => i !== index);
      return updatedEntries;
    });
  
    // Check employmentEntries.length instead of newEmploy.length
    if (employmentEntries.length === 1) {
      setWorkError("Employment is required.");
    }
  };
  
const handlePhoneChange = (event) => {
  const input = event.target.value;
  const rawInput = input.replace(/\D/g, ''); // Remove non-digit characters
  const formatted = rawInput.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  
  setPhone(formatted);
  formData({ ...data, phone: formatted });

  // Check if the input has 10 digits and clear the error if it does
  if (rawInput.length === 10) {
    setErrors((prevErrors) => ({ ...prevErrors, phone: '' }));
  } else {
    setErrors((prevErrors) => ({ ...prevErrors, phone: 'Please enter a valid 10-digit phone number.' }));
  }
};

  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    formData({ ...data, [fileType]: file });
  };

  const handleFileRemove = (fileType) => {
    formData({ ...data, [fileType]: '' });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted');
  
    // Check for required fields
    const requiredFields = ["first", "last", "email", "phone", "position", "location", "languages", "skills", "message"];
    const newErrors = {};
    let hasError = false;
    
    requiredFields.forEach(field => {
      if (!data[field]) {
        newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        hasError = true;
      }
    });
  
   // ✅ Check if resume is uploaded
   if (!data.resume) {
    newErrors.resume = "Resume is required.";
    hasError = true;
}

// ✅ Education Validation
if (addedEd.length === 0) {
    setEducationError("Education is required.");
    hasError = true;
} else {
    setEducationError(""); // ✅ Clears error if education entry exists
}
// ✅ Employment Validation
if (!data.workHistory) {
  setWorkError("Employment is required.");
  hasError = true;
} else if (data.workHistory === "Yes" && employmentEntries.length === 0) {
  setWorkError("Please add at least one employment, otherwise select 'No'.");
  hasError = true;
} else {
  setWorkError(""); // ✅ Clears error if background is valid
}
// ✅ Background Validation
if (!data.background) {
    setBackgroundError("Background is required.");
    hasError = true;
} else if (data.background === "Yes" && convictions.length === 0) {
    setBackgroundError("Please add at least one background, otherwise select 'No'.");
    hasError = true;
} else {
    setBackgroundError(""); // ✅ Clears error if background is valid
}
    if (hasError || Object.keys(newErrors).length > 0) {
      setErrorMessage('Required fields are missing.');
      setErrors(newErrors);
      return;
    }
  
    const formDataObj = new FormData();
    
    // Add basic form fields
    formDataObj.append('first', data.first);
    formDataObj.append('last', data.last);
    formDataObj.append('email', data.email);
    formDataObj.append('phone', data.phone);
    formDataObj.append('position', data.position);
    formDataObj.append('wantsDriver', wantsDriver);
    formDataObj.append('drivingRecord', JSON.stringify(wantsDriver === 'Yes' ? drivingRecord : {}));
    formDataObj.append('location', data.location);
    formDataObj.append('languages', data.languages);
    formDataObj.append('skills', data.skills);
    formDataObj.append('message', data.message);
    
    // Add files if they exist
    if (data.resume) {
      formDataObj.append("resume", data.resume);
    }
    if (data.cover) {
      formDataObj.append("cover", data.cover);
    }
    
    // Convert arrays to JSON strings before appending
    formDataObj.append("education", JSON.stringify(addedEd));
    formDataObj.append("background", JSON.stringify(convictions));
    formDataObj.append("workHistory", JSON.stringify(employmentEntries));
  for (let pair of formDataObj.entries()) {
  console.log(pair[0]+ ':', pair[1]);
}
    try {
      const response = await axios.post('/applynow', formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data' 
        }
      });
    
      if (response.data.errors) {
        if (response.data.error === "Duplicate email or phone") {
          setSubmissionErrorMessage("Application has already been submitted with this email, phone number, resume, or cover letter. If you recently worked for TBS, please call 706-263-0175. If you're new and have submitted before, please wait until we review your application.");
        } else {
          setSubmissionErrorMessage('');
        }
      } else {
        // Process submission success
        setSubmissionMessage('Application Submitted! We will be with you as soon as possible!');
        toast.success('Application Submitted! We will be with you as soon as possible!');
        navigate('/applynow');
      }
    } catch (error) {
      console.error("Submission error:", error);
      if (error.response && error.response.status === 400) {
        setSubmissionErrorMessage(error.response.data.message || "There was an error with your submission.");
      } else {
        setSubmissionErrorMessage("An unexpected error occurred. Please report any submission errors to William Rowell: (706) 879-0106 to fix the issue on your application.");
      }
    }
  };
  /*
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Reset error states before validation begins
    setErrors({});
    setSubmissionErrorMessage(""); // ✅ Clear this immediately on new submit
    setErrorMessage("");

    let hasError = false;
    let newErrors = {};

    // Required fields validation
    const requiredFields = ["first", "last", "email", "phone", "position", "languages", "skills", "message"];
    requiredFields.forEach((field) => {
        if (!data[field]) {
            newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
            hasError = true;
        }
    });

    // ✅ Check if resume is uploaded
    if (!data.resume) {
        newErrors.resume = "Resume is required.";
        hasError = true;
    }

    // ✅ Education Validation
    if (addedEd.length === 0) {
        setEducationError("Education is required.");
        hasError = true;
    } else {
        setEducationError(""); // ✅ Clears error if education entry exists
    }

    // ✅ Employment Validation
    if (!data.workHistory) {
        setWorkError("Please Add an Employment or select No");
        hasError = true;
    } else if (data.workHistory === "Yes" && employmentEntries.length === 0) {
        setWorkError("Please add at least one employment entry.");
        hasError = true;
    } else {
        setWorkError(""); // ✅ Clears error if employment history is valid
    }

    // ✅ Background Validation
    if (!data.background) {
        setBackgroundError("Background is required.");
        hasError = true;
    } else if (data.background === "Yes" && convictions.length === 0) {
        setBackgroundError("Please add at least one background, otherwise select 'No'.");
        hasError = true;
    } else {
        setBackgroundError(""); // ✅ Clears error if background is valid
    }

    // ✅ If any errors exist, return early
    if (hasError) {
        setErrorMessage("Required fields are missing.");
        setErrors(newErrors);
        return;
    }

    // ✅ If everything is correct, clear error messages
    setErrors({});
    setErrorMessage("");

    // ✅ Prepare FormData for submission
    const formDataObj = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
        formDataObj.append(key, value);
    });

    // Ensure file inputs are appended correctly
    if (data.resume) {
        formDataObj.append("resume", data.resume);
    }
    if (data.cover) {
        formDataObj.append("cover", data.cover);
    }

    formDataObj.append("education", JSON.stringify(addedEd));
    formDataObj.append("convictions", JSON.stringify(convictions));
    formDataObj.append("employmentEntries", JSON.stringify(employmentEntries));

    // 🚀 Debugging: Print all keys before submitting
    for (let pair of formDataObj.entries()) {
        console.log(`Key: ${pair[0]}, Value:`, pair[1]); 
    }

    if (data.resume) {
        formDataObj.append("resume", data.resume);
    }
    if (data.cover) {
        formDataObj.append("cover", data.cover);
    }

    try {
        const response = await axios.post("/applynow", formDataObj, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.errors) {
            if (response.data.error === "Duplicate email or phone") {
                setSubmissionErrorMessage(
                    "Application has already been submitted with this email and/or phone number. If you recently worked for TBS, please call (706) 263-0175. If you're new and have submitted before, please wait until we review your application."
                );
            } else {
                setSubmissionErrorMessage("");
            }
            return;
        }

        // ✅ Reset form fields after successful submission
        formData({
            first: "",
            last: "",
            email: "",
            phone: "",
            education: "",
            position: "",
            background: "",
            languages: "",
            skills: "",
            workHistory: "",
            resume: "",
            cover: "",
            message: "",
        });

        setEmploymentEntries([]);
        setAddedEd([]);
        setConvictions([]);
        setPhone("");

        // ✅ Clear error messages upon success
        setSubmissionErrorMessage(""); // ✅ Ensure it's cleared upon successful submission
        setErrorMessage("");

        // ✅ Show success message
        setSubmissionMessage("Application Submitted! We will be with you as soon as possible!");
        toast.success("Application Submitted! We will be with you as soon as possible!");
        navigate("/applynow");

    } catch (error) {
        console.error("Submission error:", error);
        if (error.response && error.response.status === 400) {
            console.log("Validation error:", error.response.data);
        }
    }
};
*/
  return (
    <div>
        <Header />
      <main className="apply-main">
        <div className="apply-container">
          <h1 className="apply-now">CAREERS</h1>
          <h2 className="descript">Discover a career with TBS,
            a premier leader in traffic control solutions!
            As a dynamic and rapidly growing company in the traffic management industry,
            TBS takes pride in revolutionizing how we navigate and manage traffic flow.
            Join our dedicated team and contribute to creating safer,
            more efficient roadways.</h2>
        </div>
<section className="carrier-section">
    <h2 className="carrierh2">🔶 TRAFFIC CONTROL SAFETY ADVISOR (Internal Hiring)</h2>
    <div className="internal-hiring-notice">
      <p className="carrier-ops"><strong>We're HIRING an internal Traffic Control Safety Advisor position here at TBS.</strong> This role helps ensure jobsite safety, proper traffic control setups, and compliance with OSHA and MUTCD standards, TTCP production (traffic control plans). This position comes with an hourly pay increase. Interested employees should contact management.</p>
    </div>
    <div className="job-lists">
      <div className="duty-div">
        <h2 className="duties-div">Job Duties</h2>
        <li>Inspect jobsites to ensure proper traffic control setups and compliance</li>
        <li>Produce and review Traffic Control Plans (TTCPs)</li>
        <li>Ensure compliance with OSHA and MUTCD standards</li>
        <li>Conduct safety audits and report findings to management</li>
        <li>Train crew members on safety protocols and best practices</li>
        <li>Investigate incidents and recommend corrective actions</li>
      </div>
      <div className="require-div">
        <h2 className="requirements">Requirements</h2>
        <li>Current TBS employee in good standing</li>
        <li>Knowledge of OSHA and MUTCD standards</li>
        <li>Experience with traffic control plan production</li>
        <li>Must pass a background check and drug test</li>
        <li>Strong attention to detail and safety awareness</li>
      </div>
      <div className="skills-div">
        <h2 className="skills-required">Skills Needed</h2>
        <li>Leadership and communication skills</li>
        <li>Knowledge of OSHA/MUTCD regulations</li>
        <li>Ability to read and produce traffic control plans</li>
        <li>Problem-solving and critical thinking</li>
        <li>Ability to train and mentor others</li>
      </div>
    </div>
</section>

<section className="carrier-section">
    <h2 className="carrierh2">FOREMAN</h2>
    <div className="job-lists">
      <div className="duty-div">
        <h2 className="duties-div">Job Duties</h2>
        <li>Oversee daily operations of traffic control crews on jobsites</li>
        <li>Ensure all traffic control setups meet MUTCD and project specifications</li>
        <li>Coordinate with project managers, DOT, and contractors</li>
        <li>Manage crew schedules, assignments, and performance</li>
        <li>Conduct daily safety briefings and enforce safety protocols</li>
        <li>Maintain accurate daily reports and documentation</li>
        <li>Ensure all equipment is properly maintained and accounted for</li>
      </div>
      <div className="require-div">
        <h2 className="requirements">Requirements</h2>
        <li>High School Diploma or GED</li>
        <li>Minimum 2 years of traffic control or construction experience</li>
        <li>Valid driver's license with clean driving record</li>
        <li>Valid Traffic Controller Certification or ability to obtain one</li>
        <li>Must pass a background check and drug test</li>
        <li>Able to work in ALL weather conditions</li>
        <li>Must be able to lift up to 50 lbs</li>
      </div>
      <div className="skills-div">
        <h2 className="skills-required">Skills Needed</h2>
        <li>Strong leadership and team management skills</li>
        <li>Excellent communication and organizational skills</li>
        <li>Knowledge of MUTCD standards and traffic control plans</li>
        <li>Ability to make quick decisions under pressure</li>
        <li>Conflict resolution and problem-solving abilities</li>
      </div>
    </div>
</section>

<section className="carrier-section">
    <h2 className="carrierh2">CREW LEAD</h2>
    <div className="job-lists">
      <div className="duty-div">
        <h2 className="duties-div">Job Duties</h2>
        <li>Lead a small crew of flaggers and traffic controllers on jobsites</li>
        <li>Set up and tear down traffic control devices per the traffic control plan</li>
        <li>Ensure crew follows all safety procedures and company policies</li>
        <li>Communicate with foreman and report jobsite progress</li>
        <li>Assist with training new employees on proper procedures</li>
        <li>Operate company vehicles to transport crew and equipment</li>
      </div>
      <div className="require-div">
        <h2 className="requirements">Requirements</h2>
        <li>High School Diploma or GED</li>
        <li>Minimum 1 year of traffic control experience preferred</li>
        <li>Valid Traffic Controller Certification or ability to obtain one</li>
        <li>Must pass a background check and drug test</li>
        <li>Able to work in ALL weather conditions</li>
        <li>Must be able to lift up to 50 lbs</li>
        <li>Must follow company dress code policy</li>
      </div>
      <div className="skills-div">
        <h2 className="skills-required">Skills Needed</h2>
        <li>Leadership and ability to direct a small team</li>
        <li>Strong communication skills</li>
        <li>Knowledge of traffic control setups and devices</li>
        <li>Ability to remain calm under pressure</li>
        <li>Dependability and strong work ethic</li>
      </div>
    </div>
</section>

<section className="carrier-section">
    <h2 className="carrierh2">TRAFFIC CONTROL FLAGGER</h2>
    <p className="carrier-ops">
      A Traffic Controller is responsible for directing and managing the flow of vehicles and pedestrians in and around designated areas.
      They ensure the safety of all parties, while also making sure that traffic moves efficiently.
      We offer traffic controllers with leadership opportunities including crew leads and drivers.
      If you're dependable, alert, and ready for a rewarding career, apply today and be part of something that keeps communities moving safely!
    </p>
    <div className="job-lists">
      <div className="duty-div">
        <h2 className="duties-div">Job Duties</h2>
        <li>Direct vehicles and pedestrians to ensure safety and efficiency</li>
        <li>Monitor traffic flow and adjust signals and signs as needed</li>
        <li>Communicate with other traffic controllers and emergency services as necessary</li>
        <li>Enforce traffic laws and regulations</li>
        <li>Implement detours and traffic control plans during special events or emergencies</li>
        <li>Provide assistance to disabled or stranded motorist</li>
        <li>Maintain records of traffic control activities</li>
      </div>
      <div className="require-div">
        <h2 className="requirements">Requirements</h2>
        <li>High School Diploma or GED</li>
        <li>Excellent communication and interpersonal skills</li>
        <li>Valid Traffic Controller Certification or the ability to obtain one</li>
        <li>Able to work in ALL weather conditions</li>
        <li>Ability to stand, walk, and/or direct traffic for extended periods of time</li>
        <li>Quick decision-making abilities and ability to adapt to changing situations</li>
        <li>Must pass a background check and drug test</li>
        <li>Must be able to lift up to 50 lbs</li>
        <li>Ability to move quickly out of harm's way in case of emergency</li>
        <li>Must follow company dress code policy</li>
      </div>
      <div className="skills-div">
        <h2 className="skills-required">Skills Needed</h2>
        <li>Strong communication skills</li>
        <li>Ability to remain calm under pressure</li>
        <li>Ability to enforce safety regulations while being courteous with the public</li>
        <li>Awareness of local and federal laws and regulations</li>
        <li>Good problem-solving skills</li>
        <li>Excellent attention to detail</li>
        <li>Adequate physical stamina to stand for long periods and work in challenging weather conditions</li>
        <li>Ability to work well with others and follow rules given by your foreman/crew lead</li>
      </div>
    </div>
</section>
        <form
          className="apply-set"
          method="post"
          onSubmit={handleSubmit}
        >
          <div className="job-container container--narrow page-apply-container">
      <div className="job-app-info">
            <h1 className="job-app-box">JOB APPLICATION FORM</h1>
            <h2 className="job-fill">Please Fill Out the Form Below to Submit Your Job Application!</h2>
        <h3 className="control-fill-info">Fields marked with * are required.</h3>
    </div>
    <div className="job-actual">
      <div className="job-name">
            <div className="first-input">

              <div className="first-name">
                <div className="firstname-input">
                  <label className="first-label-name">First Name *</label>
                  <input name="first" type="text" className="first-name-input" text="first-name--input" placeholder="Enter First Name"
                    value={data.first}
                    onChange={(e) => { 
                      formData({ ...data, first: e.target.value });
                    if (e.target.value) {
                      setErrors((prevErrors) => ({ ...prevErrors, first: '' })); // Clear the error
                    }
                    }}
                    />
                </div>
                {errors.first && <div className="error-message">{errors.first}</div>}
              </div>
              <div className="last-name">
                <div className="lastname-input">
                  <label className="last-label-name">Last Name *</label>
                  <input name="last" type="text" className="last-name-input" text="last-name--input" placeholder="Enter Last Name"
                    value={data.last} 
                    onChange={(e) => { 
                      formData({ ...data, last: e.target.value });
                    if (e.target.value) {
                      setErrors((prevErrors) => ({ ...prevErrors, last: '' })); // Clear the error
                    }
                    }}
                    />
                </div>
                {errors.last && <div className="error-message">{errors.last}</div>}
              </div>
            </div>
            <div className="emailphone-input">
              <div className="email">
                <div className="emailname-input">
                  <label className="email-name">Email *</label>
                  <input name="email" type="text" className="email-box" text="email--input" placeholder="Enter Email"
                    value={data.email}
                    onChange={(e) => { 
                      formData({ ...data, email: e.target.value });
                    if (e.target.value) {
                      setErrors((prevErrors) => ({ ...prevErrors, email: '' })); // Clear the error
                    }
                    }}
                    />
                </div>
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>

              <div className="phone-apply">
                <div className="phonename-input">
                  <label className="phone-apply">Phone Number *</label>
                  <input
                    name="phone"
                    type="text"
                    className="phone-box"
                    text="phone--input"
                    placeholder="Enter Phone Number"
                    value={phone} // Bind to phone state
                    onChange={handlePhoneChange}
                  />
                </div>
                {errors.phone && <div className="error-message">{errors.phone}</div>}
              </div>
            </div>
            </div>
            <div className="job-location">
              <label className="location-name">Location *</label>
              <p className="location-p">Which location would you like to work out of?</p>
              <div>
                <input className="position-checkbox" id="calhoun" type="radio" name="location"
                value="Calhoun GA"
                onChange={(e) => { 
                  formData({ ...data, location: e.target.value });
                if (e.target.value) {
                  setErrors((prevErrors) => ({ ...prevErrors, location: '' })); // Clear the error
                }
                }}
                />
                <label className="position-li" htmlFor="calhoun">Calhoun GA</label>
              </div>
              <div>
                <input className="position-checkbox" id="atlanta" type="radio" name="location"
                value="Atlanta GA"
                onChange={(e) => { 
                  formData({ ...data, location: e.target.value });
                if (e.target.value) {
                  setErrors((prevErrors) => ({ ...prevErrors, location: '' })); // Clear the error
                }
                }}
                />
                <label className="position-li" htmlFor="atlanta">Atlanta GA</label>
              </div>
              {errors.location && <div className="error-message">{errors.location}</div>}
            </div>
            <div className="education-info">
  <label className="education-label">Education History *</label>


  <div className="education-entry">
    <label>School Name:</label>
<input
  type="text"
  value={school}
  placeholder="Enter School Name"
  onChange={(e) => {
    const value = e.target.value;
    const capitalized = value.replace(/\b\w/g, (char) => char.toUpperCase());
    setSchool(capitalized);
  }}
/>
{errors.school && <div className="error-message">{errors.school}</div>}
    <div className="date-inputs">
      <label>Start Date:</label>
      <select
  value={startMonth} // ✅ Correct: Use single selected value
  onChange={(e) => setStartMonth(e.target.value)}
>
  <option value="">Month</option>
  {startMonths.map((month, idx) => (
    <option key={idx} value={month}>{month}</option>
  ))}
</select>

      {errors.startMonth && <div className="error-message">{errors.startMonth}</div>}

      <input
        type="number"
        placeholder="Year"
        onChange={(e) => setStartYear(e.target.value)}
        min="1900"
        max={new Date().getFullYear()}
      />
      {errors.startYear && <div className="error-message">{errors.startYear}</div>}
    </div>

    <div className="date-inputs">
      <label>End Date:</label>
      <select
  value={endMonth} // ✅ Correct: Use single selected value
  onChange={(e) => setEndMonth(e.target.value)}
>
  <option value="">Month</option>
  {endMonths.map((month, idx) => (
    <option key={idx} value={month}>{month}</option>
  ))}
</select>

      {errors.endMonth && <div className="error-message">{errors.endMonth}</div>}

      <input
        type="number"
        placeholder="Year"
        onChange={(e) => setEndYear(e.target.value)}
        min="1900"
        max={new Date().getFullYear()}
      />
      {errors.endYear && <div className="error-message">{errors.endYear}</div>}
    </div>
  </div>

  <button type="button" className="add-button" onClick={handleAddEducation}>
    + Add Education
  </button>

{addedEd.length > 0 ? (
        <ul className="education-list">
          {addedEd.map((entry, index) => (
           <li key={index} className="education-item">
           <p><b>School:</b> {entry.school}</p>
           <p><b>Start:</b> {entry.startMonth} {entry.startYear}</p>
           <p><b>End:</b> {entry.endMonth} {entry.endYear}</p>
     
           {/* Remove button only if there's more than one entry */}
           {addedEd.length > 0 && (
             <button type="button" className="remove-button" onClick={() => handleRemoveEducation(index)}>
               Remove
             </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-education-message">No education added yet.</p>
      )}
      {educationError && <div className="error-message">{educationError}</div>}
   </div>
            <div className="position-info">
  <label className="position-name">Position *</label>
  <p className="position-look">What position are you applying for?</p>
  {["Traffic Control Safety Advisor", "Foreman", "Crew Lead", "Traffic Control Flagger"].map((pos) => (
    <div key={pos}>
      <input className="position-checkbox" id={`pos-${pos}`} type="radio" name="position"
        value={pos}
        onChange={(e) => {
          formData({ ...data, position: e.target.value });
          if (e.target.value) setErrors((prev) => ({ ...prev, position: '' }));
        }}
      />
      <label className="position-li" htmlFor={`pos-${pos}`}>{pos}</label>
    </div>
  ))}
  {errors.position && <div className="error-message">{errors.position}</div>}

  <div className="driver-section" style={{ marginTop: '20px' }}>
    <label className="position-name">Would you like to be a Driver? (Pays more hourly)</label>
    <div>
      <input className="position-checkbox" id="driver-yes" type="radio" name="wantsDriver" value="Yes"
        onChange={(e) => setWantsDriver(e.target.value)} checked={wantsDriver === 'Yes'} />
      <label className="position-li" htmlFor="driver-yes">Yes</label>
      <input className="position-checkbox" id="driver-no" type="radio" name="wantsDriver" value="No"
        onChange={(e) => { setWantsDriver(e.target.value); setDrivingRecord({ speedingTickets: '', trafficViolations: '', duis: '', otherViolations: '' }); }} checked={wantsDriver === 'No'} />
      <label className="position-li" htmlFor="driver-no">No</label>
    </div>
    {wantsDriver === 'Yes' && (
      <div className="driving-record-section">
        <p className="driving-record-p"><strong>Please provide your driving record details:</strong></p>
        <label>How many Speeding Tickets?</label>
        <input type="number" min="0" placeholder="0" value={drivingRecord.speedingTickets}
          onChange={(e) => setDrivingRecord({ ...drivingRecord, speedingTickets: e.target.value })} />
        <label>How many Traffic Violations?</label>
        <input type="number" min="0" placeholder="0" value={drivingRecord.trafficViolations}
          onChange={(e) => setDrivingRecord({ ...drivingRecord, trafficViolations: e.target.value })} />
        <label>How many DUIs?</label>
        <input type="number" min="0" placeholder="0" value={drivingRecord.duis}
          onChange={(e) => setDrivingRecord({ ...drivingRecord, duis: e.target.value })} />
        <label>Other Violations (describe):</label>
        <textarea placeholder="Describe any other driving violations..." value={drivingRecord.otherViolations}
          onChange={(e) => setDrivingRecord({ ...drivingRecord, otherViolations: e.target.value })} />
      </div>
    )}
  </div>
  </div>
  <div className="background-history">
  <label className="background-label">Background History *</label>
  <p className="background-p">Have you ever been convicted of a felony, 
    have any misdemeanors(Ex: Speeding Tickets), and/or are on probation or parole?
    <strong> Note: </strong> If you're applying to be a driver, please click "Yes"
    and add your driving charges: Ex: How many Speeding Tickets, DUIs, and other Traffic Violation charges.
    </p>


  <div>
    <input
      className="position-checkbox"
      id="back-yes"
      type="radio"
      name="background"
      value="Yes"
      onChange={handleBackgroundChange}
      checked={data.background === "Yes"}
    />
    <label className="position-li" htmlFor="back-yes">Yes, I have charges</label>

    <input
      className="position-checkbox"
      id="back-no"
      type="radio"
      name="background"
      value="No"
      onChange={handleBackgroundChange}
      checked={data.background === "No"}
    />
    <label className="position-li" htmlFor="back-no">No, my record is clean</label>
    {data.background === "No" && (
    <div className="warning-ed-message">
      <strong className="strong-warning">WARNING:</strong>
      <p className="ed-warning">
      As part of our hiring process, we conduct automated background checks to verify any history of felonies, 
      misdemeanors, parole, or probation. If you have any of these and selected "No" 
      on your application, it may result in disqualification from the hiring process because
      of dishonesty and misconduct behavior. Honesty and integrity are fundamental values in our workplace. 
      Providing false or misleading information may result in your application being withdrawn. 
      We are committed to maintaining a safe and secure environment for our employees and customers.
We encourage all applicants to be truthful in their responses. If you have any concerns or would like 
to provide additional context regarding your background, please reach out to our hiring team.
      </p>
    </div>
  )}
  </div>
  {data.background === "Yes" && (
  <div className="conviction-entries">
    {/* Input Fields for a New Conviction Before Adding */}
    <div className="conviction-entry">
      <label>Type of Charge:</label>
      <select
        value={newConviction.type}
        onChange={(e) => setNewConviction({ ...newConviction, type: e.target.value })}
      >
        <option value="Misdemeanor">Misdemeanor</option>
        <option value="Felony">Felony</option>
      </select>

      <label>Charge:</label>
      <select
        value={newConviction.charge}
        onChange={(e) => setNewConviction({ ...newConviction, charge: e.target.value })}
      >
        <option value="">Select a Charge</option>
        {newConviction.type === "Misdemeanor"
          ? misdemeanorCharges.map((charge, idx) => (
              <option key={idx} value={charge}>{charge}</option>
            ))
          : felonyCharges.map((charge, idx) => (
              <option key={idx} value={charge}>{charge}</option>
            ))}
      </select>

      <label>Date of Conviction:</label>
      <input
        type="date"
        value={newConviction.date}
        onChange={(e) => setNewConviction({ ...newConviction, date: e.target.value })}
      />

      <label>Explain your charge:</label>
      <textarea
        placeholder="Provide details of this charge/conviction..."
        className="conviction-textarea"
        value={newConviction.explanation}
        onChange={(e) => setNewConviction({ ...newConviction, explanation: e.target.value })}
      />

      {/* Add Conviction Button */}
      <button type="button" className="add-button" onClick={addConviction}>
        + Add Background
      </button>
    </div>
    {/* Display Convictions as a List */}
    {convictions.length > 0 ? (
        <ul className="conviction-list">
          {convictions.map((conviction, index) => (
            <li key={index} className="conviction-item">
              <p><b>Type:</b> {conviction.type}</p>
              <p><b>Charge:</b> {conviction.charge}</p>
              <p><b>Date:</b> {conviction.date}</p>
              <p><b>Explanation:</b> {conviction.explanation}</p>

              {/* ✅ Remove Button - Only Show if More Than One Employment Entry Exists */}
              {convictions.length > 0 && (
                <button type="button" className="remove-button" onClick={() => removeConviction(index)}>
                Remove
              </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-conviction-message">No charges added yet.</p>
      )}
   </div>)}
   {backgroundError && <div className="error-message">{backgroundError}</div>}
   </div>
        <div className="skills">
      <label className="skills-label">Professional Skills *</label>

      {/* Language Selection */}
      <div className="language-section">
        <p className="language-p">Languages Spoken:</p>
        <select
  name="languages"
  className="language-dropbox"
  value={data.languages || ""}  // ✅ Ensure it always has a default value
  onChange={(e) => {
    formData({ ...data, languages: e.target.value });
    if (e.target.value) {
      setErrors((prevErrors) => ({ ...prevErrors, languages: '' })); // Clear the error
    }
  }}
>
  <option value="">Select a language</option>
  {selectLanguages.map((lang, index) => (
    <option key={index} value={lang.name}>{lang.name}</option>
  ))}
</select>

    {errors.languages && <div className="error-message">{errors.languages}</div>}
      </div>

      {/* Skills Textbox */}
      <div className="skills-textbox">
        <p className="skills-p">Tell us about your professional skills (current and past):</p>
        <textarea
  className="skills-input"
  placeholder="Enter your skills here..."
  value={data.skills || ""}  // ✅ Ensure it always has a default value
  onChange={(e) => { 
    formData({ ...data, skills: e.target.value });
    if (e.target.value) {
      setErrors((prevErrors) => ({ ...prevErrors, skills: '' })); // Clear the error
    }
  }}
/>

      </div>
      {errors.skills && <div className="error-message">{errors.skills}</div>}
    </div>
    <div className="employment-history">
  <label className="employment-label">Employment History *</label>

  <p className="employment-p">Have you had any previous employment?</p>

  <div>
    <input
      type="radio"
      id="emp-yes"
      name="employment"
      value="Yes"
      onChange={handleEmploymentChange}
      checked={data.workHistory === "Yes"}
    />
    <label className="yes-radio" htmlFor="emp-yes">Yes, I want to add my employment history</label>

    <input
      type="radio"
      id="emp-no"
      name="employment"
      value="No"
      onChange={handleEmploymentChange}
      checked={data.workHistory === "No"}
    />
    <label className="no-radio"  htmlFor="emp-no">I don't have or don't want to add my employment history</label>
  </div>

  {/* Show message if "No" is selected */}
  {data.workHistory === "No" && (
    <div className="no-employment-message">
      <p>It's okay if you're just starting in the workforce or prefer not to provide past employment details.</p>
    </div>
  )}

  {/* Show input fields only if "Yes" is selected */}
  {data.workHistory === "Yes" && (
    <div className="employment-entries">
      <div className="employment-entry">
<input
  className="employer-name"
  placeholder="Employer Name"
  type="text"
  value={newEmploy.employerName}
  onChange={(e) => {
    const raw = e.target.value;
    const formatted = raw.replace(/\b\w/g, (char) => char.toUpperCase());
    handleEmployment2Change("employerName", formatted);
  }}
/>
<input
  className="address"
  placeholder="Employer Address"
  type="text"
  value={newEmploy.address}
  onChange={(e) => {
    const value = e.target.value;
    handleEmployment2Change("address", value);
    if (value.trim()) {
      setErrors((prevErrors) => ({ ...prevErrors, address: '' }));
    }
  }}
  />
<input
  className="city"
  placeholder="City"
  type="text"
  value={newEmploy.city}
  onChange={(e) => {
    const sanitized = e.target.value.replace(/[^\w\s]/gi, ''); // Removes punctuation
    const formatted = sanitized
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalizes first letter of each word
    handleEmployment2Change("city", formatted);
  }}
/>
        <select
          className="state"
          value={newEmploy.state}
          onChange={(e) => handleEmployment2Change("state", e.target.value)}
        >
          <option value="">Select a State</option>
          {states.map((state) => (
            <option key={state.abbreviation} value={state.abbreviation}>
              {state.name}
            </option>
          ))}
        </select>
        <input
          className="zip"
          placeholder="Zip Code"
          type="text"
          value={newEmploy.zip}
          onChange={(e) => handleEmployment2Change("zip", e.target.value)}
        />
        <input
          className="phone"
          placeholder="Employer Phone Number"
          type="text"
          value={newEmploy.phone}
          onChange={(e) => handleEmployment2Change("phone", e.target.value)}
        />
        <textarea
          className="duties"
          placeholder="Describe your job duties"
          value={newEmploy.duties}
          onChange={(e) => handleEmployment2Change("duties", e.target.value)}
        ></textarea>

        <div>
          <input
            type="checkbox"
            id="currently-employed"
            checked={newEmploy.currentlyEmployed}
            onChange={(e) => handleEmployment2Change("currentlyEmployed", e.target.checked)}
          />
          <label htmlFor="currently-employed">Currently Employed</label>
        </div>

        {!newEmploy.currentlyEmployed && (
          <textarea
            className="reason-for-leaving"
            placeholder="Reason for Leaving"
            value={newEmploy.reasonForLeaving}
            onChange={(e) => handleEmployment2Change("reasonForLeaving", e.target.value)}
          />
        )}

        <p className="contact-employer">May we contact this employer?</p>
        <div>
          <input
            type="radio"
            id="contact-yes"
            name="mayContact"
            value="Yes"
            onChange={(e) => handleEmployment2Change("mayContact", e.target.value)}
            checked={newEmploy.mayContact === "Yes"}
          />
          <label htmlFor="contact-yes">Yes</label>

          <input
            type="radio"
            id="contact-no"
            name="mayContact"
            value="No"
            onChange={(e) => handleEmployment2Change("mayContact", e.target.value)}
            checked={newEmploy.mayContact === "No"}
          />
          <label htmlFor="contact-no">No</label>
        </div>

        {/* ✅ Add Employment Button */}
        <button type="button" className="add-button" onClick={addEmploymentEntry}>
          + Add Employment
        </button>
      </div>

      {/* ✅ Show List Only If an Entry Exists */}
      {employmentEntries.length > 0 ? (
        <ul className="employment-list">
          {employmentEntries.map((entry, index) => (
            <li key={index} className="employment-item">
              <p><b>Employer:</b> {entry.employerName}</p>
              <p><b>Address:</b> {entry.address}, {entry.city}, {entry.state}, {entry.zip}</p>
              <p><b>Phone:</b> {entry.phone}</p>
              <p><b>Job Duties:</b> {entry.duties}</p>
              <p><b>Currently Employed:</b> {entry.currentlyEmployed ? "Yes" : "No"}</p>
              {!entry.currentlyEmployed && <p><b>Reason for Leaving:</b> {entry.reasonForLeaving}</p>}
              <p><b>May We Contact?:</b> {entry.mayContact}</p>

              {/* ✅ Remove Button - Only Show if More Than One Employment Entry Exists */}
              {employmentEntries.length > 0 && (
                <button type="button" onClick={() => removeEmploymentEntry(index)} className="remove-employment-btn">
                  Remove Employment
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-employment-message">No employments added yet.</p>
      )}
    </div>
  )}
  {/* ✅ Show error message if needed */}
  {workError && <div className="error-message">{workError}</div>}
</div>
            <div className="job-resume">
            <h2 className="resume-note"><b className="resume-note-b">NOTE:</b> You can only submit .doc, .pdf, .txt, and .pages files. Your resume is required before you submit.
              Cover letters are optional but are recommended. </h2>
            <div className="resume-input">
              <div className="resume-section">
                <div className="name-input">
                  <label htmlFor="resume-label" className="resume-name">Resume *</label>
                  <div className="file-apply-input-container">
                    <label className="file-apply-label">
                      {data.resume ? (
                        <span>{data.resume.name}</span>
                      ) : (
                        <span>CHOOSE RESUME</span>
                      )}
<input
  type="file"
  name="resume"
  accept=".pdf,.doc,.docx,.txt,.pages,.jpg,.jpeg,.png,.heic,.heif,image/*"
  onChange={(e) => {
    handleFileChange(e, 'resume');
    if (e.target.files[0]) {
      setErrors((prevErrors) => ({ ...prevErrors, resume: '' })); // Clear the error
    }
  }}
/>
                    </label>
                    {data.resume && (
                      <button type="button" className="remove-apply-file-button" onClick={() => handleFileRemove('resume')}>REMOVE</button>
                    )}
                  </div>
                  {errors.resume && <div className="error-message">{errors.resume}</div>}
                </div>
              </div>
            </div>
            <div className="cover-letter">
              <div className="name-input">
                <label className="cover-name">Cover Letter</label>
                <div className="file-input-container">
                  <label className="file-apply-label">
                    {data.cover ? (
                      <span>{data.cover.name}</span>
                    ) : (
                      <span>CHOOSE COVER LETTER</span>
                    )}
                    <input type="file" name="cover" accept=".pdf,.doc,.docx,.txt,.page" onChange={(e) => handleFileChange(e, 'cover')} />
                  </label>
                  {data.cover && (
                    <button type="button" className="remove-apply-file-button" onClick={() => handleFileRemove('cover')}>REMOVE</button>
                  )}
                </div>
              </div>
            </div>
                  </div>
                  <div className="job-message">
            <label className="message-label">Message *</label>
            <h2 className="message-note">Tell us why you want to work for TBS! </h2>

            <textarea className="message-text" name="message" type="text" placeholder="Enter Message"
              value={data.message}
              onChange={(e) => { 
                formData({ ...data, message: e.target.value });
              if (e.target.value) {
                setErrors((prevErrors) => ({ ...prevErrors, message: '' })); // Clear the error
              }
              }}
              />
              {errors.message && <div className="error-message">{errors.message}</div>}
            <h2 className="warning-message"><b className="submit-notice">NOTICE:</b> If you have already submitted before, you will not be able to submit again. If you're a former
              employee for TBS and want your job back, please call (706) 263-0175. If you're new and just submitted, your information has already
                 been received!</h2>
                 </div>
                 </div>
            <button type="submit" className="btn btn--full submit-app">SUBMIT APPLICATION</button>
            
            
            {submissionErrorMessage && (
  <div className="submission-error-message">{submissionErrorMessage}</div>
)}
{/* Display general error message */}
{errorMessage && (
  <div className="submission-error-message">{errorMessage}</div>
)}
{/* Display submission success message */}
{submissionMessage && (
  <div className="submission-message">{submissionMessage}</div>
)}
            
          {/* Display submission error message */}
          </div>
        </form>

      </main>
      <footer className="footer">
  <div className="site-footer__inner">
    <img className="tbs-logo" alt="TBS logo" src={images["../assets/tbs_companies/tbs white.svg"].default} />
    <div className="footer-navigation-content">
      <h2 className="footer-title">Navigation</h2>
    <ul className="footer-navigate">
      <li><a className="footer-nav-link" href="/about-us">About Us</a></li>
      <li><a className="footer-nav-link" href="/traffic-control-services">Traffic Control Services</a></li>
      <li><a className="footer-nav-link" href="product-services">Product Services</a></li>
      <li><a className="footer-nav-link" href="/contact-us">Contact Us</a></li>
      <li><a className="footer-nav-link-view" href="">Careers</a></li>
    </ul>
    </div>
    <div className="footer-contact">
      <h2 className="footer-title">Contact</h2>
      <p className="contact-info">
        <a className="will-phone" href="tel:+17062630175">Call: 706-263-0175</a>
        <a className="will-email" href="mailto: tbsolutions1999@gmail.com">Email: tbsolutions1999@gmail.com</a>
        <a className="will-address" href="https://www.google.com/maps/place/Traffic+and+Barrier+Solutions,+LLC/@34.5025307,-84.899317,660m/data=!3m1!1e3!4m6!3m5!1s0x482edab56d5b039b:0x94615ce25483ace6!8m2!3d34.5018691!4d-84.8994308!16s%2Fg%2F11pl8d7p4t?entry=ttu&g_ep=EgoyMDI1MDEyMC4wIKXMDSoASAFQAw%3D%3D"
      >
        1995 Dews Pond Rd, Calhoun, GA 30701</a>
      </p>
    </div>

    <div className="social-icons">
      <h2 className="footer-title">Follow Us</h2>
      <a className="social-icon" href="https://www.facebook.com/tbssigns2022/" target="_blank" rel="noopener noreferrer">
                    <img className="facebook-img" src={images["../assets/social media/facebook.png"].default} alt="Facebook" />
                </a>
                <a className="social-icon" href="https://www.tiktok.com/@tbsmaterialworx?_t=8lf08Hc9T35&_r=1" target="_blank" rel="noopener noreferrer">
                    <img className="tiktok-img" src={images["../assets/social media/tiktok.png"].default} alt="TikTok" />
                </a>
                <a className="social-icon" href="https://www.instagram.com/tbsmaterialworx?igsh=YzV4b3doaTExcjN4&utm_source=qr" target="_blank" rel="noopener noreferrer">
                    <img className="insta-img" src={images["../assets/social media/instagram.png"].default} alt="Instagram" />
                </a>
    </div>
    <div className="statement-box">
                <p className="statement">
                    <b className="safety-b">Safety Statement: </b>
                    At TBS, safety is our top priority. We are dedicated to ensuring the well-being of our employees, clients, 
                    and the general public in every aspect of our operations. Through comprehensive safety training, 
                    strict adherence to regulatory standards, and continuous improvement initiatives, 
                    we strive to create a work environment where accidents and injuries are preventable. 
                    Our commitment to safety extends beyond compliance—it's a fundamental value embedded in everything we do. 
                    Together, we work tirelessly to promote a culture of safety, 
                    accountability, and excellence, because when it comes to traffic control, there's no compromise on safety.
                </p>
            </div>
  </div>
</footer>
<div className="footer-copyright">
      <p className="footer-copy-p">&copy; 2026 Traffic & Barrier Solutions, LLC - 
        Website MERN Stack Coded & Deployed by <a className="footer-face"href="https://www.facebook.com/will.rowell.779" target="_blank" rel="noopener noreferrer">William Rowell</a> - All Rights Reserved.</p>
    </div>
    </div>
  );
}
export default Apply;
