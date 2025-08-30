import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Check,
  FileText,
  Upload,
  Globe,
  Smartphone,
  Glasses,
  Search,
  Bot,
  Headphones,
  Copy,
  LogOut,
} from "lucide-react";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "your-supabase-url",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-supabase-anon-key"
);

// Header Component with User Info
const Header = ({ user, signOut }) => (
  <>
    {/* Responsive CSS */}
    <style jsx>{`
      @media (max-width: 768px) {
        .header-container {
          padding: 0 16px !important;
          margin-bottom: 16px !important;
        }
        .user-info {
          flex-direction: column !important;
          gap: 8px !important;
          padding: 12px !important;
          width: 100% !important;
        }
        .user-email {
          font-size: 12px !important;
          text-align: center;
          word-break: break-all;
        }
        .sign-out-btn {
          width: 100% !important;
          justify-content: center !important;
          padding: 8px 16px !important;
        }
      }
      @media (max-width: 480px) {
        .user-info {
          padding: 10px !important;
        }
        .user-email {
          font-size: 11px !important;
        }
        .sign-out-btn {
          font-size: 11px !important;
          padding: 6px 12px !important;
        }
      }
    `}</style>

    <div
      className="header-container"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: "24px",
        width: "100%",
      }}
    >
      {/* User Info Section */}
      {user && (
        <div
          className="user-info"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 16px",
            borderRadius: "12px",
            backgroundColor: "#ffffff",
            color: "#1f2937",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            fontSize: "14px",
            maxWidth: "100%",
          }}
        >
          <div className="user-email">
            <div style={{ fontWeight: "600" }}>{user.email}</div>
          </div>

          <button
            className="sign-out-btn"
            onClick={signOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              borderRadius: "8px",
              backgroundColor: "#ef4444",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              whiteSpace: "nowrap",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#dc2626")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#ef4444")
            }
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  </>
);

// Step Header Component
const StepHeader = ({ currentStep }) => {
  return (
    <div style={{ textAlign: "center", marginBottom: "48px" }}>
      {/* Inline animation styles */}
      <style>
        {`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .fade-slide {
            animation: fadeSlideIn 0.4s ease forwards;
          }
        `}
      </style>

      <h1
        className="step-title fade-slide"
        style={{
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "12px",
          color: "#111827",
        }}
      >
        Welcome to RAG.CX
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {[1, 2, 3, 4, 5].map((step, index) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;

          return (
            <div
              key={step}
              style={{ display: "flex", alignItems: "center" }}
              className="fade-slide"
            >
              {/* Circle */}
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "600",
                  fontSize: "16px",
                  transition: "all 0.3s ease",
                  backgroundColor: isActive
                    ? "#A259FF" // purple for active
                    : isCompleted
                      ? "#22C55E" // green for completed
                      : "#E5E7EB", // gray for pending
                  color: isActive || isCompleted ? "#fff" : "#6B7280",
                }}
              >
                {isCompleted ? "✔" : step}
              </div>

              {/* Connector line */}
              {index < 4 && (
                <div
                  style={{
                    width: "40px",
                    height: "2px",
                    margin: "0 8px",
                    transition: "all 0.3s ease",
                    backgroundColor: isCompleted ? "#22C55E" : "#E5E7EB",
                  }}
                  className="fade-slide"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// File Upload Step Component
const FileUploadStep = ({
  isDragging,
  uploadedFile,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileInput,
  formatFileSize,
}) => (
  <div style={{ width: "100%" }}>
    {/* Title */}
    <h2
      className="step-title"
      style={{
        fontSize: "28px",
        fontWeight: "700",
        textAlign: "center",
        marginBottom: "40px",
        color: "#111827",
        transition: "color 0.3s ease",
      }}
    >
      Upload Your Document
    </h2>

    {/* Upload Area */}
    <div
      className="upload-area"
      style={{
        border: "2px dashed",
        borderColor: isDragging ? "#A259FF" : "#D1D5DB",
        borderRadius: "16px",
        padding: "30px",
        textAlign: "center",
        maxWidth: "900px",
        margin: "0 auto",
        backgroundColor: isDragging ? "#F5F3FF" : "transparent",
        transition: "all 0.2s ease",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Document Icon */}
      <FileText
        style={{
          width: "64px",
          height: "64px",
          margin: "0 auto 32px auto",
          color: "#9CA3AF",
        }}
      />

      {/* Text */}
      <p
        style={{
          fontSize: "18px",
          marginBottom: "40px",
          color: "#4B5563",
          transition: "color 0.3s ease",
        }}
      >
        {isDragging
          ? "Drop your file here"
          : "Drag and drop your document here"}
      </p>

      {/* Browse File Button */}
      <label style={{ display: "inline-block" }}>
        <input
          type="file"
          onChange={handleFileInput}
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: "none" }}
        />
        <span
          style={{
            backgroundColor: "#A259FF",
            color: "#fff",
            padding: "12px 32px",
            borderRadius: "9999px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "16px",
            fontWeight: "500",
            transition: "background-color 0.3s ease",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.backgroundColor = "#7C3AED")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = "#A259FF")
          }
        >
          <Upload style={{ width: "16px", height: "16px" }} />
          Browse File
        </span>
      </label>
    </div>

    {/* File Upload Success */}
    {uploadedFile && (
      <div
        style={{
          marginTop: "24px",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #BBF7D0",
          backgroundColor: "#ECFDF5",
          maxWidth: "900px",
          marginLeft: "auto",
          marginRight: "auto",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <FileText
            style={{
              width: "24px",
              height: "24px",
              color: "#059669",
            }}
          />
          <div>
            <p
              style={{
                fontWeight: "600",
                fontSize: "18px",
                color: "#065F46",
              }}
            >
              {uploadedFile.name}
            </p>
            <p
              style={{
                fontSize: "14px",
                color: "#059669",
              }}
            >
              {formatFileSize(uploadedFile.size)}
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
);
// Platform Step Component
const PlatformStep = ({ selectedPlatform, setSelectedPlatform }) => {
  const [hovered, setHovered] = useState(null);

  const platforms = [
    { id: "web", icon: Globe, label: "Web App" },
    { id: "mobile", icon: Smartphone, label: "Mobile App", comingSoon: true },
    { id: "ar", icon: Glasses, label: "AR", comingSoon: true },
  ];

  const baseCardStyle = {
    padding: "32px",
    borderRadius: "16px",
    border: "1px solid #E5E7EB",
    backgroundColor: "#FFFFFF",
    color: "#374151",
    transition: "all 0.3s ease-in-out",
    position: "relative",
    textAlign: "center",
    cursor: "pointer",
  };

  const activeCardStyle = {
    backgroundColor: "#F9FAFB",
    border: "1px solid #A259FF",
    color: "#111827",
    boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
  };

  const hoverCardStyle = {
    border: "1px solid #A259FF",
    boxShadow: "0 4px 10px rgba(162,89,255,0.25)",
  };

  const comingSoonCardStyle = {
    backgroundColor: "#F9FAFB",
    border: "1px solid #E5E7EB",
    color: "#9CA3AF",
    cursor: "not-allowed",
  };

  const containerStyle = {
    borderRadius: "16px",
    padding: "32px",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    transition: "background-color 0.3s ease",
  };

  const headingStyle = {
    fontSize: "24px",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: "32px",
    color: "#111827",
    transition: "color 0.3s ease",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "24px",
  };

  const comingSoonBadgeStyle = {
    position: "absolute",
    top: "-12px",
    right: "12px",
    background: "linear-gradient(to right, #fb923c, #ec4899)",
    color: "white",
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 12px",
    borderRadius: "9999px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  };

  return (
    <div style={containerStyle}>
      <h2 className="platform-title" style={headingStyle}>
        Select Your Platform
      </h2>

      <div className="platform-grid" style={gridStyle}>
        {platforms.map(({ id, icon: Icon, label, comingSoon }) => {
          let cardStyle = { ...baseCardStyle };

          if (selectedPlatform === id) {
            cardStyle = { ...cardStyle, ...activeCardStyle };
          } else if (comingSoon) {
            cardStyle = { ...cardStyle, ...comingSoonCardStyle };
          } else if (hovered === id) {
            cardStyle = { ...cardStyle, ...hoverCardStyle };
          }

          return (
            <button
              key={id}
              className="platform-card"
              onClick={() => !comingSoon && setSelectedPlatform(id)}
              onMouseEnter={() => !comingSoon && setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              disabled={comingSoon}
              style={cardStyle}
            >
              <Icon
                style={{ width: "40px", height: "40px", margin: "0 auto 16px" }}
              />
              <p style={{ fontWeight: "500", fontSize: "16px" }}>{label}</p>

              {comingSoon && (
                <span style={comingSoonBadgeStyle}>Coming Soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Element Step Component
const ElementStep = ({ selectedElement, setSelectedElement }) => {
  const elements = [
    { id: "search", icon: Search, label: "Search Box" },
    { id: "ai-agent", icon: Bot, label: "AI Agent" },
    { id: "support-agent", icon: Headphones, label: "Support Agent" },
  ];

  const cardStyle = {
    borderRadius: "16px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    padding: "32px",
    transition: "all 0.3s ease",
    backgroundColor: "#ffffff",
  };

  const headingStyle = {
    fontSize: "24px",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: "32px",
    transition: "color 0.3s ease",
    color: "#111827",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
  };

  return (
    <div style={cardStyle}>
      <h2 className="platform-title" style={headingStyle}>
        Select an Element
      </h2>
      <div className="platform-grid" style={gridStyle}>
        {elements.map(({ id, icon: Icon, label }) => {
          const isSelected = selectedElement === id;
          return (
            <button
              key={id}
              className="platform-card"
              onClick={() => setSelectedElement(id)}
              style={{
                padding: "24px",
                borderRadius: "12px",
                border: `2px solid ${isSelected ? "#A259FF" : "#e5e7eb"}`,
                backgroundColor: isSelected ? "#A259FF" : "#ffffff",
                color: isSelected ? "#ffffff" : "#374151",
                fontWeight: "500",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#A259FF";
                  e.currentTarget.style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              <Icon
                style={{ width: "32px", height: "32px", margin: "0 auto 12px" }}
              />
              <p>{label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Domain Step Component
const DomainStep = ({
  allowedDomains,
  currentDomain,
  setCurrentDomain,
  domainError,
  addDomain,
  removeDomain,
  saveDomainConfiguration,
  savingDomains,
}) => {
  return (
    <div style={{ width: "100%" }}>
      <h2
        className="step-title"
        style={{
          fontSize: "28px",
          fontWeight: "700",
          textAlign: "center",
          marginBottom: "40px",
          color: "#111827",
        }}
      >
        Configure Domain Access
      </h2>

      <div
        style={{
          borderRadius: "16px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          padding: "32px",
          backgroundColor: "#fff",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              marginBottom: "12px",
              color: "#111827",
            }}
          >
            Authorized Domains
          </h3>
          <p
            style={{
              fontSize: "14px",
              color: "#6B7280",
              marginBottom: "16px",
              lineHeight: "1.5",
            }}
          >
            Add the domains where your AI widget should be allowed to work. For
            security, the widget will only function on these specified domains.
          </p>
        </div>

        {/* Add Domain Input */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={currentDomain}
              onChange={(e) => {
                setCurrentDomain(e.target.value);
                if (domainError) {
                  setDomainError("");
                }
              }}
              placeholder="Enter domain (e.g., example.com)"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: domainError ? "2px solid #EF4444" : "1px solid #D1D5DB",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addDomain();
                }
              }}
            />
            <button
              onClick={addDomain}
              style={{
                padding: "12px 16px",
                backgroundColor: "#A259FF",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#7C3AED")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#A259FF")
              }
            >
              Add Domain
            </button>
          </div>

          {domainError && (
            <p
              style={{
                color: "#EF4444",
                fontSize: "12px",
                marginTop: "4px",
              }}
            >
              {domainError}
            </p>
          )}
        </div>

        {/* Domain List */}
        {allowedDomains.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h4
              style={{
                fontSize: "16px",
                fontWeight: "600",
                marginBottom: "12px",
                color: "#111827",
              }}
            >
              Authorized Domains ({allowedDomains.length})
            </h4>
            <div style={{ space: "8px" }}>
              {allowedDomains.map((domain, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                    marginBottom: "8px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#111827",
                      fontFamily: "monospace",
                    }}
                  >
                    {domain}
                  </span>
                  <button
                    onClick={() => removeDomain(domain)}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#EF4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#DC2626")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#EF4444")
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <button
            onClick={saveDomainConfiguration}
            disabled={allowedDomains.length === 0 || savingDomains}
            style={{
              padding: "12px 24px",
              backgroundColor:
                allowedDomains.length > 0 && !savingDomains
                  ? "#22C55E"
                  : "#D1D5DB",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              cursor:
                allowedDomains.length > 0 && !savingDomains
                  ? "pointer"
                  : "not-allowed",
              transition: "all 0.2s ease",
              minWidth: "150px",
            }}
            onMouseEnter={(e) => {
              if (allowedDomains.length > 0 && !savingDomains) {
                e.currentTarget.style.backgroundColor = "#16A34A";
              }
            }}
            onMouseLeave={(e) => {
              if (allowedDomains.length > 0 && !savingDomains) {
                e.currentTarget.style.backgroundColor = "#22C55E";
              }
            }}
          >
            {savingDomains ? "Saving..." : "Continue to Script"}
          </button>

          {allowedDomains.length === 0 && (
            <p
              style={{
                fontSize: "12px",
                color: "#6B7280",
                marginTop: "8px",
                fontStyle: "italic",
              }}
            >
              Add at least one domain to continue
            </p>
          )}
        </div>

        {/* Info Box */}
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            backgroundColor: "#FEF3C7",
            border: "1px solid #F59E0B",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#92400E",
            lineHeight: "1.4",
          }}
        >
          <strong>🔒 Security Note:</strong> Your AI widget will only work on
          the domains you specify here. This prevents unauthorized use of your
          widget on other websites. You can add localhost for testing.
        </div>
      </div>
    </div>
  );
};

// Script Step Component
const ScriptStep = ({ selectedPlatform, selectedElement, generateScript }) => {
  const [scriptCopied, setScriptCopied] = useState(false);

  const copyScript = () => {
    navigator.clipboard.writeText(generateScript());
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  };

  return (
    <div
      style={{
        borderRadius: "16px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        padding: "32px",
        backgroundColor: "#fff",
        transition: "all 0.3s ease",
      }}
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: "600",
          textAlign: "center",
          marginBottom: "24px",
          color: "#111827",
          transition: "color 0.3s ease",
        }}
      >
        Generated Script
      </h2>

      <div style={{ position: "relative" }}>
        <textarea
          value={selectedPlatform && selectedElement ? generateScript() : ""}
          readOnly
          style={{
            width: "100%",
            height: "250px",
            padding: "16px",
            fontFamily: "monospace",
            fontSize: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            backgroundColor: "#F9FAFB",
            color: "#111827",
            resize: "none",
            outline: "none",
            transition: "all 0.3s ease",
          }}
        />

        <button
          onClick={copyScript}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            backgroundColor: "#A259FF",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#7C3AED")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#A259FF")
          }
        >
          {scriptCopied ? <Check size={16} /> : <Copy size={16} />}
          <span>{scriptCopied ? "Copied!" : "Copy Script"}</span>
        </button>
      </div>

      {scriptCopied && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "14px",
            textAlign: "center",
            border: "1px solid #D1FAE5",
            backgroundColor: "#ECFDF5",
            color: "#065F46",
            transition: "all 0.3s ease",
          }}
        >
          ✅ Script copied to clipboard!
        </div>
      )}

      {selectedElement === "ai-agent" && (
        <div
          style={{
            marginTop: "24px",
            padding: "20px",
            borderRadius: "12px",
            backgroundColor: "#FEF3C7",
            border: "1px solid #F59E0B",
            color: "#92400E",
            fontSize: "14px",
            lineHeight: "1.6",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            🚀 How to use your AI Agent:
          </h3>
          <ol style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
            <li>Copy the script above</li>
            <li>
              Paste it as a script tag in any website:{" "}
              <code>&lt;script&gt;[paste here]&lt;/script&gt;</code>
            </li>
            <li>The AI chat button will appear in the bottom-right corner</li>
            <li>
              Users can click it to ask questions about your uploaded documents
            </li>
          </ol>
          <p style={{ margin: "0", fontSize: "13px", fontStyle: "italic" }}>
            <strong>Note:</strong> For the AI to work, users need to be
            authenticated with your RAG system. The current version shows
            authentication prompts for unauthenticated users.
          </p>
        </div>
      )}
    </div>
  );
};

export default function SecureRAGHome() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Organization state
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [workingMode, setWorkingMode] = useState("personal");
  const [orgLoading, setOrgLoading] = useState(false);

  // Member management state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [selectedOrgForMembers, setSelectedOrgForMembers] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  // Document upload state
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadMode, setUploadMode] = useState("text");
  const [selectedFile, setSelectedFile] = useState(null);
  const [processingStats, setProcessingStats] = useState(null);
  const [documentVisibility, setDocumentVisibility] = useState("private");
  const [searchScope, setSearchScope] = useState("all");

  // New step flow state
  const [currentStep, setCurrentStep] = useState(0); // 0: mode selection, 1: file upload, 2: platform, 3: element, 4: domain, 5: script
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Domain restriction state
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [currentDomain, setCurrentDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const [savingDomains, setSavingDomains] = useState(false);

  const fileInputRef = useRef(null);

  // Authentication effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load organizations when user is authenticated
  useEffect(() => {
    if (user) {
      loadUserOrganizations();
    }
  }, [user]);

  // Authentication functions
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      alert("Error signing in: " + error.message);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear local state
      setFilename("");
      setContent("");
      setQuestion("");
      setAnswer("");
      setSources([]);
      setProcessingStats(null);
      setSelectedFile(null);
      setOrganizations([]);
      setSelectedOrganization(null);
      setWorkingMode("personal");
    } catch (error) {
      alert("Error signing out: " + error.message);
    }
  };

  // Organization functions
  const loadUserOrganizations = async () => {
    if (!session?.access_token) return;

    setOrgLoading(true);
    try {
      const response = await fetch("/api/organizations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      } else {
        console.error("Failed to load organizations");
      }
    } catch (error) {
      console.error("Error loading organizations:", error);
    }
    setOrgLoading(false);
  };

  const createOrganization = async () => {
    const name = prompt("Enter organization name:");
    if (!name || !name.trim()) return;

    const description =
      prompt("Enter organization description (optional):") || "";

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Organization "${name}" created successfully!`);
        await loadUserOrganizations();
      } else {
        alert("Error: " + result.error);
      }
    } catch (error) {
      alert("Error creating organization: " + error.message);
    }
  };

  // Member management functions
  const loadOrganizationMembers = async (orgId) => {
    if (!session?.access_token) return;

    setMembersLoading(true);
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      } else {
        console.error("Failed to load organization members");
        setMembers([]);
      }
    } catch (error) {
      console.error("Error loading members:", error);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const addMemberToOrganization = async (orgId, email, role) => {
    if (!session?.access_token) return;
    if (!email?.trim()) {
      alert("Please enter a valid email address");
      return;
    }

    setMemberActionLoading(true);
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          role: role,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Member "${email}" added successfully as ${role}!`);
        setNewMemberEmail("");
        setNewMemberRole("member");
        await loadOrganizationMembers(orgId);
      } else {
        alert("Error: " + (result.error || "Failed to add member"));
      }
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Error adding member: " + error.message);
    } finally {
      setMemberActionLoading(false);
    }
  };

  const removeMemberFromOrganization = async (orgId, userId) => {
    if (!session?.access_token) return;

    if (confirm("Are you sure you want to remove this member?")) {
      setMemberActionLoading(true);
      try {
        const response = await fetch(`/api/organizations/${orgId}/members`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        });

        if (response.ok) {
          alert("Member removed successfully!");
          await loadOrganizationMembers(orgId);
        } else {
          const result = await response.json();
          alert("Error: " + (result.error || "Failed to remove member"));
        }
      } catch (error) {
        console.error("Error removing member:", error);
        alert("Error removing member: " + error.message);
      } finally {
        setMemberActionLoading(false);
      }
    }
  };

  const switchWorkingMode = (mode, orgId = null) => {
    setWorkingMode(mode);
    setSelectedOrganization(orgId);

    if (mode === "organization") {
      setDocumentVisibility("organization");
      setSearchScope("all");
    } else {
      setDocumentVisibility("private");
      setSearchScope("all");
    }

    setAnswer("");
    setSources([]);
    setProcessingStats(null);
  };

  // New step flow helper functions
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    setUploadedFile({
      name: file.name,
      size: file.size,
    });
    setSelectedFile(file);
    setFilename(file.name);
    setFileUploading(true);

    try {
      // Use existing saveDocument logic
      const formData = new FormData();
      formData.append("file", file);
      formData.append("visibility", documentVisibility);

      const orgId =
        workingMode === "organization" ? selectedOrganization : null;
      if (orgId) {
        formData.append("organization_id", orgId);
      }

      const response = await fetch("/api/save", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadSuccess(true);
        setProcessingStats(result.stats);
        // Auto move to next step after successful upload
        setTimeout(() => {
          setCurrentStep(2); // Move to platform selection
        }, 2000);
      } else {
        alert("Error uploading file: " + result.error);
      }
    } catch (error) {
      alert("Error uploading file: " + error.message);
    }
    setFileUploading(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const generateScript = () => {
    if (!selectedPlatform || !selectedElement || allowedDomains.length === 0)
      return "";

    // Get production API URL based on environment
    const getApiUrl = () => {
      if (typeof window !== "undefined") {
        // Client-side: Use current origin for production, or localhost for development
        return window.location.hostname === "localhost"
          ? "http://localhost:3000"
          : "https://messy-ragcx.vercel.app";
      }
      // Server-side fallback
      return "https://messy-ragcx.vercel.app";
    };

    // Generate production-ready scripts based on selected element
    const scripts = {
      search: `
        (function() {
          var host = document.currentScript;
          
          // Root container
          var container = document.createElement("div");
          container.setAttribute("aria-hidden","false");
          container.style.cssText = "position:fixed;bottom:22px;right:22px;z-index:99999;";
          
          // Search box
          var searchBox = document.createElement("div");
          searchBox.style.cssText = "background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 10px 25px rgba(0,0,0,0.1);width:320px;";
          
          var input = document.createElement("input");
          input.type = "text";
          input.placeholder = "Search your documents...";
          input.style.cssText = "width:100%;border:none;outline:none;font-size:14px;";
          
          searchBox.appendChild(input);
          container.appendChild(searchBox);
          document.body.appendChild(container);
        })();
      `,
      "ai-agent": `
(function() {
  // Domain validation - SECURITY FEATURE
  var allowedDomains = ${JSON.stringify(allowedDomains)};
  var currentDomain = window.location.hostname;
  
  // Check if current domain is authorized
  var isDomainAllowed = allowedDomains.some(function(domain) {
    return currentDomain === domain || currentDomain.endsWith('.' + domain);
  });
  
  if (!isDomainAllowed) {
    console.warn('AI Agent Widget: This domain (' + currentDomain + ') is not authorized to use this widget.');
    console.warn('Authorized domains:', allowedDomains);
    return; // Exit if domain not allowed
  }
  
  console.log('AI Agent Widget: Domain authorized (' + currentDomain + ')');

  // Production Configuration - Dynamic API URL Detection
  var config = {
    apiUrl: '${getApiUrl()}',
    primaryColor: '#A259FF',
    hoverColor: '#7C3AED',
    textColor: '#333',
    backgroundColor: '#fff',
    userId: '${user?.id || "anonymous"}',
    userToken: null, // Will be set dynamically
    allowedDomains: allowedDomains,
    currentDomain: currentDomain
  };

  // Authentication helper - Get user token from Supabase
  function getUserToken() {
    try {
      // Try to get token from localStorage (Supabase stores session here)
      const session = JSON.parse(localStorage.getItem('supabase.auth.token') || '{}');
      if (session && session.access_token) {
        return session.access_token;
      }
      
      // Alternative: Try to get from Supabase client if available
      if (typeof window !== 'undefined' && window.supabase) {
        return window.supabase.auth.session()?.access_token;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get user token:', error);
      return null;
    }
  }

  // Initialize authentication token
  config.userToken = getUserToken();

  // Create AI Agent Container
  var aiContainer = document.createElement('div');
  aiContainer.id = 'rag-ai-agent-production';
  aiContainer.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;font-family:Arial,sans-serif;';

  // Chat Widget (initially hidden)
  var chatWidget = document.createElement('div');
  chatWidget.style.cssText = 'display:none;width:350px;height:500px;background:white;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.2);overflow:hidden;border:1px solid #e5e7eb;flex-direction:column;';

  // Chat Header
  var chatHeader = document.createElement('div');
  chatHeader.style.cssText = 'background:' + config.primaryColor + ';color:white;padding:16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
  
  var headerContent = document.createElement('div');
  headerContent.innerHTML = '<strong>🤖 Your Personal AI</strong><br><small>Searching only YOUR documents</small>';
  
  var closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = 'background:none;border:none;color:white;font-size:20px;cursor:pointer;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;';
  
  chatHeader.appendChild(headerContent);
  chatHeader.appendChild(closeButton);

  // Chat Messages Container
  var messagesContainer = document.createElement('div');
  messagesContainer.style.cssText = 'height:320px;overflow-y:auto;padding:16px;background:#f9f9f9;flex:1;';
  
  // Initial welcome message
  var welcomeMsg = document.createElement('div');
  welcomeMsg.style.cssText = 'background:white;padding:12px;border-radius:12px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);';
  welcomeMsg.innerHTML = '<strong>Your Personal AI:</strong><br>Hello! I can help you find information from YOUR uploaded documents. What would you like to know?';
  messagesContainer.appendChild(welcomeMsg);

  // Chat Input Container
  var inputContainer = document.createElement('div');
  inputContainer.style.cssText = 'padding:16px;background:white;border-top:1px solid #e5e7eb;display:flex;gap:8px;min-height:70px;box-sizing:border-box;flex-shrink:0;';

  var chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.placeholder = 'Ask about your documents...';
  chatInput.style.cssText = 'flex:1;padding:12px;border:1px solid #d1d5db;border-radius:8px;outline:none;font-size:14px;height:40px;box-sizing:border-box;background:white;';

  var sendButton = document.createElement('button');
  sendButton.innerHTML = '➤';
  sendButton.style.cssText = 'background:' + config.primaryColor + ';color:white;border:none;border-radius:8px;padding:12px 16px;cursor:pointer;font-size:16px;height:40px;min-width:50px;';

  inputContainer.appendChild(chatInput);
  inputContainer.appendChild(sendButton);

  // Assemble chat widget
  chatWidget.appendChild(chatHeader);
  chatWidget.appendChild(messagesContainer);
  chatWidget.appendChild(inputContainer);

  // Floating Chat Button
  var chatButton = document.createElement('button');
  chatButton.style.cssText = 'width:60px;height:60px;border-radius:50%;background:' + config.primaryColor + ';border:none;cursor:pointer;box-shadow:0 4px 16px rgba(162,89,255,0.4);color:white;font-size:24px;transition:all 0.3s ease;';
  chatButton.innerHTML = '🤖';

  // Add to container
  aiContainer.appendChild(chatWidget);
  aiContainer.appendChild(chatButton);
  document.body.appendChild(aiContainer);

  // State management
  var isOpen = false;
  var isLoading = false;

  // Chat functions
  function toggleChat() {
    isOpen = !isOpen;
    chatWidget.style.display = isOpen ? 'flex' : 'none';
    chatButton.style.transform = isOpen ? 'scale(0.9)' : 'scale(1)';
    
    if (isOpen) {
      setTimeout(function() {
        chatInput.focus();
      }, 100);
    }
  }

  function addMessage(content, isUser = false, isError = false) {
    var messageDiv = document.createElement('div');
    var bgColor = isUser ? config.primaryColor : (isError ? '#ef4444' : 'white');
    var textColor = isUser ? 'white' : (isError ? 'white' : config.textColor);
    
    messageDiv.style.cssText = 'background:' + bgColor + ';color:' + textColor + ';padding:12px;border-radius:12px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);word-wrap:break-word;';
    messageDiv.innerHTML = (isUser ? '<strong>You:</strong><br>' : (isError ? '<strong>Error:</strong><br>' : '<strong>Your AI:</strong><br>')) + content;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show loading indicator
  function showLoading() {
    var loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.cssText = 'background:white;padding:12px;border-radius:12px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);';
    loadingDiv.innerHTML = '<strong>Your AI:</strong><br>🔍 Searching your documents...';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideLoading() {
    var loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }

  // Send message to API with real authentication
  async function sendMessage(question) {
    if (isLoading || !question.trim()) return;
    
    // Refresh token if needed
    if (!config.userToken) {
      config.userToken = getUserToken();
    }
    
    if (!config.userToken) {
      addMessage('Authentication required. Please log in to your main application first to access your documents.', false, true);
      return;
    }
    
    isLoading = true;
    addMessage(question, true);
    showLoading();
    
    try {
      const response = await fetch(config.apiUrl + '/api/ask-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.userToken
        },
        body: JSON.stringify({
          question: question,
          search_scope: 'user'
        })
      });

      hideLoading();
      
      if (response.ok) {
        const data = await response.json();
        var answer = data.answer || 'Sorry, I could not find an answer in your documents.';
        
        if (data.stats) {
          answer += '<br><br><small><strong>📊 Search Stats:</strong><br>';
          answer += '• Your documents searched: ' + (data.stats.documentsSearched || 0) + '<br>';
          answer += '• Relevant results: ' + (data.stats.relevantDocuments || 0) + '</small>';
        }
        
        if (data.sources && data.sources.length > 0) {
          answer += '<br><br><small><strong>📄 Sources from your documents:</strong><br>';
          data.sources.forEach(function(source, index) {
            answer += (index + 1) + '. ' + source.filename + '<br>';
            answer += '   "' + source.text + '"<br>';
          });
          answer += '</small>';
        }
        
        answer += '<br><br><small>🔒 Searching only YOUR documents</small>';
        
        addMessage(answer);
      } else if (response.status === 401) {
        addMessage('Authentication expired. Please refresh your main application and try again.', false, true);
      } else {
        const errorData = await response.json();
        addMessage(errorData.error || 'Sorry, something went wrong. Please try again.', false, true);
      }
    } catch (error) {
      hideLoading();
      console.error('API Error:', error);
      addMessage('Connection error. Please check that your server is running on ' + config.apiUrl, false, true);
    }
    
    isLoading = false;
  }

  // Event listeners
  chatButton.addEventListener('click', toggleChat);
  closeButton.addEventListener('click', toggleChat);
  
  sendButton.addEventListener('click', function() {
    sendMessage(chatInput.value);
    chatInput.value = '';
  });
  
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage(chatInput.value);
      chatInput.value = '';
    }
  });

  // Hover effects
  chatButton.addEventListener('mouseenter', function() {
    this.style.background = config.hoverColor;
    this.style.transform = 'scale(1.1)';
  });
  
  chatButton.addEventListener('mouseleave', function() {
    this.style.background = config.primaryColor;
    this.style.transform = isOpen ? 'scale(0.9)' : 'scale(1)';
  });
  
  sendButton.addEventListener('mouseenter', function() {
    this.style.background = config.hoverColor;
  });
  
  sendButton.addEventListener('mouseleave', function() {
    this.style.background = config.primaryColor;
  });

  console.log('Production AI Agent initialized successfully for user:', config.userId);
})();
      `,
      "support-agent": `
        (function() {
          var host = document.currentScript;
          
          // Root container
          var container = document.createElement("div");
          container.setAttribute("aria-hidden","false");
          container.style.cssText = "position:fixed;bottom:22px;right:22px;z-index:99999;";
          
          // Support Agent button
          var btn = document.createElement("button");
          btn.setAttribute("aria-label","Open support chat");
          btn.style.cssText = "width:60px;height:60px;border-radius:50%;background:#10B981;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.3);";
          
          var icon = document.createElement("div");
          icon.innerHTML = "🎧";
          icon.style.cssText = "font-size:24px;";
          
          btn.appendChild(icon);
          container.appendChild(btn);
          document.body.appendChild(container);
          
          btn.onclick = function() {
            alert("Support chat would open here!");
          };
        })();
      `,
    };

    return scripts[selectedElement] || "";
  };

  const copyScript = () => {
    const script = generateScript();
    navigator.clipboard.writeText(`<script>${script}</script>`).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 3000);
    });
  };

  const handleModeSelection = (mode, orgId = null) => {
    switchWorkingMode(mode, orgId);
    setCurrentStep(1); // Move to file upload step
  };

  const handlePlatformSelection = (platform) => {
    setSelectedPlatform(platform);
    setCurrentStep(3); // Move to element selection
  };

  const handleElementSelection = (element) => {
    setSelectedElement(element);
    setCurrentStep(4); // Move to domain configuration
  };

  // Domain management functions
  const addDomain = () => {
    if (!currentDomain.trim()) {
      setDomainError("Please enter a domain");
      return;
    }

    // Validate domain format
    const domainPattern = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    const domain = currentDomain.trim().toLowerCase();

    // Remove protocol if included
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!domainPattern.test(cleanDomain) && cleanDomain !== "localhost") {
      setDomainError(
        "Please enter a valid domain (e.g., example.com, subdomain.example.com)"
      );
      return;
    }

    if (allowedDomains.includes(cleanDomain)) {
      setDomainError("Domain already added");
      return;
    }

    setAllowedDomains([...allowedDomains, cleanDomain]);
    setCurrentDomain("");
    setDomainError("");
  };

  const removeDomain = (domainToRemove) => {
    setAllowedDomains(
      allowedDomains.filter((domain) => domain !== domainToRemove)
    );
  };

  const saveDomainConfiguration = async () => {
    if (allowedDomains.length === 0) {
      setDomainError("Please add at least one domain");
      return;
    }

    setSavingDomains(true);
    try {
      const response = await fetch("/api/save-domain-config", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowedDomains,
          platform: selectedPlatform,
          element: selectedElement,
          organizationId:
            workingMode === "organization" ? selectedOrganization?.id : null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setCurrentStep(5); // Move to script generation
      } else {
        setDomainError(result.error || "Failed to save domain configuration");
      }
    } catch (error) {
      setDomainError("Network error. Please try again.");
    }
    setSavingDomains(false);
  };

  // Loading screen
  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  // Authentication screen
  if (!user) {
    return (
      <div
        style={{
          padding: "20px",
          maxWidth: "400px",
          margin: "100px auto",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ marginBottom: "30px" }}>Enhanced RAG System</h1>
        <p style={{ marginBottom: "30px", color: "#666" }}>
          Please sign in to upload documents and ask questions
        </p>
        <button
          onClick={signInWithGoogle}
          style={{
            padding: "12px 30px",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // Main application - new step-based flow
  return (
    <>
      {/* Global Responsive CSS */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .main-container {
          min-height: 100vh;
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        }

        .content-wrapper {
          max-width: 1024px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        @media (max-width: 768px) {
          .content-wrapper {
            padding: 16px 16px;
            max-width: 100%;
          }

          .mode-title {
            font-size: 1.75rem !important;
            line-height: 2rem !important;
            margin-bottom: 16px !important;
          }

          .mode-subtitle {
            font-size: 0.875rem !important;
            margin-bottom: 24px !important;
            padding: 0 8px;
          }

          .mode-buttons {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 0 8px;
          }

          .mode-button {
            width: 100% !important;
            padding: 16px !important;
            font-size: 14px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            min-height: 120px !important;
            justify-content: center !important;
          }

          .step-title {
            font-size: 1.5rem !important;
            line-height: 2rem !important;
          }

          .step-subtitle {
            font-size: 0.875rem !important;
            padding: 0 16px;
          }
        }

        @media (max-width: 480px) {
          .content-wrapper {
            padding: 12px 12px;
          }

          .mode-title {
            font-size: 1.5rem !important;
            line-height: 1.75rem !important;
          }

          .mode-subtitle {
            font-size: 0.8rem !important;
            padding: 0 4px;
          }

          .mode-button {
            padding: 14px !important;
            font-size: 13px !important;
          }

          .step-title {
            font-size: 1.25rem !important;
          }

          .step-subtitle {
            font-size: 0.8rem !important;
            padding: 0 8px;
          }
        }

        /* Modal Responsive Styles */
        @media (max-width: 768px) {
          .modal-container {
            padding: 16px !important;
          }

          .modal-content {
            width: 95% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 20px !important;
          }

          .modal-title {
            font-size: 1.25rem !important;
          }

          .org-button {
            padding: 12px !important;
            font-size: 14px !important;
          }

          .org-name {
            font-size: 14px !important;
          }

          .org-description {
            font-size: 12px !important;
          }

          /* Platform Grid Responsive */
          .platform-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            max-width: 400px !important;
            margin: 0 auto !important;
          }

          .platform-card {
            width: 100% !important;
            padding: 20px !important;
            min-height: 120px !important;
          }

          .platform-title {
            font-size: 1.5rem !important;
          }
        }

        @media (max-width: 480px) {
          .modal-content {
            width: 98% !important;
            padding: 16px !important;
          }

          .modal-title {
            font-size: 1.125rem !important;
          }

          .org-button {
            padding: 10px !important;
            font-size: 13px !important;
          }

          /* Platform Grid Mobile */
          .platform-grid {
            gap: 12px !important;
            max-width: 300px !important;
          }

          .platform-card {
            padding: 16px !important;
            min-height: 100px !important;
          }

          .platform-title {
            font-size: 1.25rem !important;
          }

          /* File Upload Responsive */
          .upload-area {
            padding: 20px !important;
            margin: 0 8px !important;
          }

          .upload-title {
            font-size: 20px !important;
            margin-bottom: 16px !important;
          }
        }
      `}</style>

      <div className="main-container">
        <div className="content-wrapper">
          <Header user={user} signOut={signOut} />

          {/* Mode Selection Step */}
          {currentStep === 0 && (
            <div style={{ textAlign: "center" }}>
              <h1
                className="mode-title"
                style={{
                  fontSize: "2.25rem",
                  fontWeight: "bold",
                  marginBottom: "0.5rem",
                  transition: "color 0.3s",
                  color: "#111827",
                }}
              >
                Welcome to RAG.CX
              </h1>
              <p
                className="mode-subtitle"
                style={{
                  fontSize: "1.125rem",
                  marginBottom: "3rem",
                  transition: "color 0.3s",
                  color: "#4B5563",
                }}
              >
                Choose your working mode
              </p>

              <div
                style={{
                  borderRadius: "1rem",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                  padding: "2rem",
                  transition: "background-color 0.3s",
                  backgroundColor: "#fff",
                }}
              >
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "600",
                    textAlign: "center",
                    marginBottom: "2rem",
                    transition: "color 0.3s",
                    color: "#111827",
                  }}
                >
                  Select Mode
                </h2>

                <div
                  className="mode-buttons"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5rem",
                    alignItems: "stretch",
                  }}
                >
                  {/* Personal Mode */}
                  <button
                    className="mode-button"
                    onClick={() => handleModeSelection("personal")}
                    style={{
                      padding: "2rem",
                      borderRadius: "0.75rem",
                      border: "2px solid",
                      borderColor: "#E5E7EB",
                      backgroundColor: "#fff",
                      color: "#374151",
                      transition: "all 0.2s",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      minHeight: "200px",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.borderColor = "#A259FF")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.borderColor = "#E5E7EB")
                    }
                  >
                    <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>
                      👤
                    </div>
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Personal Mode
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "#4B5563",
                      }}
                    >
                      Upload and manage your personal documents
                    </p>
                  </button>

                  {/* Organization Mode */}
                  <button
                    className="mode-button"
                    onClick={() => setShowMemberModal(true)}
                    style={{
                      padding: "2rem",
                      borderRadius: "0.75rem",
                      border: "2px solid",
                      borderColor: "#E5E7EB",
                      backgroundColor: "#fff",
                      color: "#374151",
                      transition: "all 0.2s",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      minHeight: "200px",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.borderColor = "#A259FF")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.borderColor = "#E5E7EB")
                    }
                  >
                    <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>
                      🏢
                    </div>
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Organization Mode
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "#4B5563",
                      }}
                    >
                      Work with your orgs documents
                    </p>
                  </button>

                  {/* Organization Selection Modal */}
                  {showMemberModal && (
                    <div
                      className="modal-container"
                      style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 50,
                        padding: "1rem",
                      }}
                    >
                      <div
                        className="modal-content"
                        style={{
                          padding: "1.5rem",
                          borderRadius: "0.5rem",
                          maxWidth: "28rem",
                          width: "100%",
                          margin: "1rem",
                          backgroundColor: "#fff",
                        }}
                      >
                        <h3
                          className="modal-title"
                          style={{
                            fontSize: "1.125rem",
                            fontWeight: "600",
                            marginBottom: "1rem",
                            color: "#111827",
                          }}
                        >
                          Select Organization
                        </h3>

                        <div style={{ marginBottom: "1rem" }}>
                          {organizations.map((org) => (
                            <button
                              key={org.id}
                              className="org-button"
                              onClick={() => {
                                setSelectedOrgForMembers(org);
                                setShowMemberModal(false);
                                setShowMemberManagement(true);
                                loadOrganizationMembers(org.id);
                              }}
                              style={{
                                width: "100%",
                                padding: "0.75rem",
                                textAlign: "left",
                                borderRadius: "0.375rem",
                                border: "1px solid",
                                borderColor: "#E5E7EB",
                                marginBottom: "0.5rem",
                                backgroundColor: "#fff",
                                transition: "background-color 0.2s",
                                cursor: "pointer",
                                color: "#111827",
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#F9FAFB")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.backgroundColor = "#fff")
                              }
                            >
                              <div
                                className="org-name"
                                style={{ fontWeight: "500" }}
                              >
                                {org.name}
                              </div>
                              <div
                                className="org-description"
                                style={{
                                  fontSize: "0.875rem",
                                  color: "#4B5563",
                                }}
                              >
                                {org.description}
                              </div>
                            </button>
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={createOrganization}
                            style={{
                              flex: 1,
                              backgroundColor: "#A259FF",
                              color: "#fff",
                              padding: "0.5rem 1rem",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              border: "none",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#7C3AED")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#A259FF")
                            }
                          >
                            Create New
                          </button>
                          <button
                            onClick={() => setShowMemberModal(false)}
                            style={{
                              flex: 1,
                              padding: "0.5rem 1rem",
                              borderRadius: "0.375rem",
                              border: "1px solid",
                              borderColor: "#D1D5DB",
                              color: "#374151",
                              cursor: "pointer",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#F9FAFB")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Member Management Modal */}
          {showMemberManagement && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "0.5rem",
                  padding: "2rem",
                  width: "90%",
                  maxWidth: "600px",
                  maxHeight: "80vh",
                  overflow: "auto",
                }}
              >
                <div style={{ marginBottom: "1.5rem" }}>
                  <h2
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "600",
                      color: "#111827",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Manage Members - {selectedOrgForMembers?.name}
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                    Add members and assign roles for this organization
                  </p>
                </div>

                {/* Current Members */}
                <div style={{ marginBottom: "2rem" }}>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "1rem",
                    }}
                  >
                    Current Members
                  </h3>
                  {members.length === 0 ? (
                    <p style={{ color: "#6B7280", fontStyle: "italic" }}>
                      No members added yet
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      {members.map((member, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem",
                            border: "1px solid #E5E7EB",
                            borderRadius: "0.375rem",
                            backgroundColor: "#F9FAFB",
                          }}
                        >
                          <div>
                            <div
                              style={{ fontWeight: "500", color: "#111827" }}
                            >
                              {member.email}
                            </div>
                            <div
                              style={{ fontSize: "0.875rem", color: "#6B7280" }}
                            >
                              {member.role}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              removeMemberFromOrganization(
                                selectedOrgForMembers.id,
                                member.user_id
                              )
                            }
                            style={{
                              backgroundColor: "#EF4444",
                              color: "#fff",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#DC2626")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#EF4444")
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Member */}
                <div style={{ marginBottom: "2rem" }}>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "1rem",
                    }}
                  >
                    Add New Member
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#374151",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="Enter member email"
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #D1D5DB",
                          borderRadius: "0.375rem",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#374151",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Role
                      </label>
                      <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #D1D5DB",
                          borderRadius: "0.375rem",
                          fontSize: "0.875rem",
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <button
                      onClick={() =>
                        addMemberToOrganization(
                          selectedOrgForMembers.id,
                          newMemberEmail,
                          newMemberRole
                        )
                      }
                      disabled={!newMemberEmail?.trim()}
                      style={{
                        backgroundColor: newMemberEmail?.trim()
                          ? "#A259FF"
                          : "#D1D5DB",
                        color: "#fff",
                        padding: "0.5rem 1rem",
                        borderRadius: "0.375rem",
                        border: "none",
                        cursor: newMemberEmail?.trim()
                          ? "pointer"
                          : "not-allowed",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                      }}
                      onMouseOver={(e) => {
                        if (newMemberEmail?.trim()) {
                          e.currentTarget.style.backgroundColor = "#7C3AED";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (newMemberEmail?.trim()) {
                          e.currentTarget.style.backgroundColor = "#A259FF";
                        }
                      }}
                    >
                      Add Member
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setShowMemberManagement(false)}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #D1D5DB",
                      backgroundColor: "#fff",
                      color: "#374151",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = "#F9FAFB")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor = "#fff")
                    }
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleModeSelection(
                        "organization",
                        selectedOrgForMembers.id
                      );
                      setShowMemberManagement(false);
                    }}
                    style={{
                      backgroundColor: "#A259FF",
                      color: "#fff",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.375rem",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = "#7C3AED")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor = "#A259FF")
                    }
                  >
                    Continue to Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step Flow with Header */}
          {currentStep > 0 && (
            <>
              <StepHeader currentStep={currentStep} />

              <div className="relative overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{
                    transform: `translateX(-${(currentStep - 1) * 100}%)`,
                  }}
                >
                  {/* File Upload Step */}
                  <div className="w-full flex-shrink-0">
                    <FileUploadStep
                      isDragging={isDragging}
                      uploadedFile={uploadedFile}
                      handleDragOver={handleDragOver}
                      handleDragLeave={handleDragLeave}
                      handleDrop={handleDrop}
                      handleFileInput={handleFileInput}
                      formatFileSize={formatFileSize}
                    />

                    {fileUploading && (
                      <div className="mt-6 p-4 rounded-lg text-center bg-blue-50 text-blue-800">
                        Uploading document...
                      </div>
                    )}

                    {uploadSuccess && (
                      <div
                        style={{
                          marginTop: "24px",
                          padding: "16px",
                          borderRadius: "12px",
                          textAlign: "center",
                          backgroundColor: "#ECFDF5", // soft green
                          color: "#065F46", // dark green text
                          fontSize: "16px",
                          fontWeight: "500",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>✅</span>
                        <span>
                          File has been uploaded successfully! Moving to next
                          step...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Platform Selection Step */}
                  <div className="w-full flex-shrink-0">
                    <PlatformStep
                      selectedPlatform={selectedPlatform}
                      setSelectedPlatform={handlePlatformSelection}
                    />
                  </div>

                  {/* Element Selection Step */}
                  <div className="w-full flex-shrink-0">
                    <ElementStep
                      selectedElement={selectedElement}
                      setSelectedElement={handleElementSelection}
                    />
                  </div>

                  {/* Domain Configuration Step */}
                  <div className="w-full flex-shrink-0">
                    <DomainStep
                      allowedDomains={allowedDomains}
                      currentDomain={currentDomain}
                      setCurrentDomain={setCurrentDomain}
                      domainError={domainError}
                      addDomain={addDomain}
                      removeDomain={removeDomain}
                      saveDomainConfiguration={saveDomainConfiguration}
                      savingDomains={savingDomains}
                    />
                  </div>

                  {/* Script Generation Step */}
                  <div className="w-full flex-shrink-0">
                    <ScriptStep
                      selectedPlatform={selectedPlatform}
                      selectedElement={selectedElement}
                      generateScript={generateScript}
                      copyScript={copyScript}
                      scriptCopied={scriptCopied}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
