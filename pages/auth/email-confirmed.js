import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check, AlertCircle, Mail } from "lucide-react";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "your-supabase-url",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-supabase-anon-key"
);

export default function EmailConfirmedPage() {
  const [verificationStatus, setVerificationStatus] = useState("loading");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const verifyEmailFromUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const type = urlParams.get('type');
      
      if (!token || !type) {
        setVerificationStatus("missing-params");
        return;
      }

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type
        });

        if (error) {
          console.error("Email verification error:", error);
          setVerificationStatus("error");
        } else if (data.user) {
          setVerificationStatus("success");
          
          // Start countdown for redirect
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                window.location.href = "/";
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setVerificationStatus("error");
        }
      } catch (error) {
        console.error("Verification error:", error);
        setVerificationStatus("error");
      }
    };

    verifyEmailFromUrl();
  }, []);

  const getContent = () => {
    switch (verificationStatus) {
      case "loading":
        return {
          icon: <Mail className="animate-pulse" size={64} />,
          title: "Verifying Your Email...",
          message: "Please wait while we confirm your email address.",
          bgColor: "#FEF3C7",
          borderColor: "#F59E0B",
          textColor: "#92400E"
        };
        
      case "success":
        return {
          icon: <Check size={64} />,
          title: "Email Verified Successfully!",
          message: `Your email has been confirmed. Redirecting to the app in ${countdown} seconds...`,
          bgColor: "#ECFDF5",
          borderColor: "#22C55E",
          textColor: "#065F46"
        };
        
      case "error":
        return {
          icon: <AlertCircle size={64} />,
          title: "Verification Failed",
          message: "The verification link is invalid or has expired. Please try signing up again or request a new verification email.",
          bgColor: "#FEF2F2",
          borderColor: "#EF4444",
          textColor: "#991B1B"
        };
        
      case "missing-params":
        return {
          icon: <AlertCircle size={64} />,
          title: "Invalid Verification Link",
          message: "This verification link appears to be incomplete. Please check your email for the correct link.",
          bgColor: "#FEF2F2",
          borderColor: "#EF4444",
          textColor: "#991B1B"
        };
        
      default:
        return {
          icon: <AlertCircle size={64} />,
          title: "Unknown Error",
          message: "Something went wrong. Please try again.",
          bgColor: "#FEF2F2",
          borderColor: "#EF4444",
          textColor: "#991B1B"
        };
    }
  };

  const content = getContent();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "500px",
          width: "100%",
          backgroundColor: "#fff",
          borderRadius: "16px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          padding: "40px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "24px" }}>
          <img src="/z-logo.svg" alt="RAG.CX" style={{ height: "48px" }} />
          <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>
            RAG.CX
          </div>
        </div>

        {/* Status Icon */}
        <div
          style={{
            marginBottom: "24px",
            color: content.textColor,
          }}
        >
          {content.icon}
        </div>

        {/* Status Message */}
        <div
          style={{
            backgroundColor: content.bgColor,
            border: `1px solid ${content.borderColor}`,
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: content.textColor,
              marginBottom: "12px",
              margin: 0,
            }}
          >
            {content.title}
          </h1>
          
          <p
            style={{
              fontSize: "16px",
              color: content.textColor,
              lineHeight: "1.6",
              margin: 0,
            }}
          >
            {content.message}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {verificationStatus === "success" && (
            <button
              onClick={() => window.location.href = "/"}
              style={{
                backgroundColor: "#22C55E",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#16A34A"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#22C55E"}
            >
              Continue to App
            </button>
          )}

          {(verificationStatus === "error" || verificationStatus === "missing-params") && (
            <>
              <button
                onClick={() => window.location.href = "/auth"}
                style={{
                  backgroundColor: "#A259FF",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#7C3AED"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#A259FF"}
              >
                Sign In Again
              </button>
              
              <button
                onClick={() => window.location.href = "/"}
                style={{
                  backgroundColor: "transparent",
                  color: "#6B7280",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                  e.currentTarget.style.borderColor = "#9CA3AF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "#D1D5DB";
                }}
              >
                Go to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}