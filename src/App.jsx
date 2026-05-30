const { useEffect, useMemo, useState } = React;

const LOGIN_DETAILS = {
  username: "admin",
  password: "12345"
};

const emptyForm = {
  name: "",
  rollNo: "",
  className: ""
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("studentCrudLoggedIn") === "true"
  );
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [students, setStudents] = useState([]);
  const [studentForm, setStudentForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [agentMessages, setAgentMessages] = useState([
    {
      role: "agent",
      text: "Hi, send student details like: add student name: Rahul Sharma roll: 101 class: 10 A"
    }
  ]);

  useEffect(() => {
    if (isLoggedIn) {
      loadStudents();
    }
  }, [isLoggedIn]);

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    return data;
  }

  async function loadStudents() {
    setIsLoading(true);
    try {
      const data = await requestJson("/api/students");
      setStudents(data.students);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return students;
    }

    return students.filter((student) =>
      Object.values(student).some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, students]);

  const classCount = useMemo(
    () => new Set(students.map((student) => student.className).filter(Boolean)).size,
    [students]
  );

  function getInitials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function handleLogin(event) {
    event.preventDefault();

    if (
      loginForm.username === LOGIN_DETAILS.username &&
      loginForm.password === LOGIN_DETAILS.password
    ) {
      localStorage.setItem("studentCrudLoggedIn", "true");
      setIsLoggedIn(true);
      setLoginError("");
      return;
    }

    setLoginError("Invalid username or password.");
  }

  function handleLogout() {
    localStorage.removeItem("studentCrudLoggedIn");
    setIsLoggedIn(false);
    setLoginForm({ username: "", password: "" });
  }

  function updateForm(field, value) {
    setStudentForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      if (editingId) {
        await requestJson(`/api/students/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(studentForm)
        });
        setMessage("Student details updated in database.");
      } else {
        await requestJson("/api/students", {
          method: "POST",
          body: JSON.stringify(studentForm)
        });
        setMessage("Student details saved in database.");
      }

      setEditingId(null);
      setStudentForm(emptyForm);
      await loadStudents();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleEdit(student) {
    setStudentForm({
      name: student.name,
      rollNo: student.rollNo,
      className: student.className
    });
    setEditingId(student.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm("Delete this student record?");
    if (confirmDelete) {
      try {
        await requestJson(`/api/students/${id}`, { method: "DELETE" });
        setMessage("Student deleted from database.");
        if (editingId === id) {
          setEditingId(null);
          setStudentForm(emptyForm);
        }
        await loadStudents();
      } catch (error) {
        setMessage(error.message);
      }
    }
  }

  function handleCancelEdit() {
    setEditingId(null);
    setStudentForm(emptyForm);
  }

  async function handleAgentSubmit(event) {
    event.preventDefault();
    const text = agentInput.trim();
    if (!text) {
      return;
    }

    setAgentInput("");
    setAgentMessages((current) => [...current, { role: "user", text }]);

    try {
      const data = await requestJson("/api/agent", {
        method: "POST",
        body: JSON.stringify({ message: text })
      });

      setAgentMessages((current) => [...current, { role: "agent", text: data.reply }]);
      if (data.student) {
        setMessage("Agent added student to database.");
        await loadStudents();
      }
    } catch (error) {
      setAgentMessages((current) => [...current, { role: "agent", text: error.message }]);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <div>
            <p className="eyebrow">Student Portal</p>
            <h1>Login</h1>
            <p className="muted">Use username admin and password 12345.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Username
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="Enter username"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Enter password"
                required
              />
            </label>

            {loginError && <p className="error">{loginError}</p>}
            <button type="submit">Login</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EM</div>
          <div>
            <strong>EduManage</strong>
            <span>Student Management</span>
          </div>
        </div>

        <nav className="side-nav">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#students">Students</a>
          <a href="#add-student">Add Student</a>
          <a href="#reports">Reports</a>
          <a href="#settings">Settings</a>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <section className="dashboard">
        <header className="topbar" id="dashboard">
          <button className="menu-button" type="button" aria-label="Open menu">
            =
          </button>
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, Admin</p>
          </div>
          <div className="admin-profile">
            <div className="admin-avatar">A</div>
            <div>
              <strong>Admin User</strong>
              <span>Administrator</span>
            </div>
          </div>
        </header>

        <section className="summary-grid">
          <article className="summary-card purple">
            <span>Total Students</span>
            <strong>{students.length}</strong>
            <small>Saved in database</small>
          </article>
          <article className="summary-card blue">
            <span>Classes</span>
            <strong>{classCount}</strong>
            <small>Unique classes</small>
          </article>
          <article className="summary-card green">
            <span>Displayed</span>
            <strong>{filteredStudents.length}</strong>
            <small>Visible records</small>
          </article>
        </section>

        <section className="workspace">
          <form className="student-form" id="add-student" onSubmit={handleSubmit}>
            <div className="section-heading">
              <p className="eyebrow">Manage Record</p>
              <h2>{editingId ? "Edit Student" : "Add Student"}</h2>
            </div>
            {message && <p className="status-message">{message}</p>}

            <div className="form-grid">
              <label>
                Student Name
                <input
                  value={studentForm.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Enter student name"
                  required
                />
              </label>

              <label>
                Roll Number
                <input
                  value={studentForm.rollNo}
                  onChange={(event) => updateForm("rollNo", event.target.value)}
                  placeholder="Enter roll number"
                  required
                />
              </label>

              <label>
                Class
                <input
                  value={studentForm.className}
                  onChange={(event) => updateForm("className", event.target.value)}
                  placeholder="Example: 10 A"
                  required
                />
              </label>

            </div>

            <div className="form-actions">
              <button type="submit">{editingId ? "Update Student" : "Add Student"}</button>
              {editingId && (
                <button type="button" className="secondary-button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <section className="agent-panel">
            <div className="section-heading">
              <p className="eyebrow">Agent</p>
              <h2>Student Agent Chat</h2>
            </div>

            <div className="chat-box">
              {agentMessages.map((chat, index) => (
                <div className={`chat-message ${chat.role}`} key={`${chat.role}-${index}`}>
                  {chat.text}
                </div>
              ))}
            </div>

            <form className="agent-form" onSubmit={handleAgentSubmit}>
              <textarea
                value={agentInput}
                onChange={(event) => setAgentInput(event.target.value)}
                placeholder="add student name: Priya Patel roll: 220 class: 10 B"
              />
              <button type="submit">Send to Agent</button>
            </form>
          </section>

          <section className="table-section" id="students">
            <div className="table-header">
              <div>
                <p className="eyebrow">Students</p>
                <h2>{isLoading ? "Loading Students" : "Student Details Table"}</h2>
              </div>
              <input
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students..."
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Roll Number</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="student-name">
                          <span className="student-avatar">{getInitials(student.name)}</span>
                          {student.name}
                        </div>
                      </td>
                      <td>
                        <span className="class-pill">{student.className}</span>
                      </td>
                      <td>{student.rollNo}</td>
                      <td className="action-cell">
                        <button type="button" className="icon-button" onClick={() => handleEdit(student)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-button danger-button"
                          onClick={() => handleDelete(student.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!filteredStudents.length && (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        No student details found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
