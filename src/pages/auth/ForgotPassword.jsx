// ForgotPassword.jsx
import React, { useState } from "react";
import {
  requestForgotPassword,
  resetForgotPassword,
} from "../../api/forgetpassword.js";

export function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(Array(4).fill("")); // backend expects 4-digit
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Request reset
  const handleResetPassword = async () => {
    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      const res = await requestForgotPassword(email, "email");
      console.log("Reset request success:", res);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to request reset.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Code input
  const handleCodeChange = (value, index) => {
    if (/^[0-9]?$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      if (value && index < code.length - 1) {
        document.getElementById(`code-${index + 1}`).focus();
      }
    }
  };

  const handleVerifyCode = () => {
    const enteredCode = code.join("");
    if (enteredCode.length === 4) {
      setStep(3);
    } else {
      alert("Enter a valid 4-digit code.");
    }
  };

  // Step 3: Reset password
  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await resetForgotPassword(email, "email", code.join(""), password);
      console.log("Password reset success:", res);
      setStep(4);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    window.location.href = "/login"; // Redirect to login page
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-50">
      <div className="bg-white shadow-md rounded-2xl p-8 w-[400px] text-center">
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold mb-2">Forgot password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Please enter your email to reset the password
            </p>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded-lg w-full p-2 mb-4"
            />
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="bg-[#012E89] text-white w-full py-2 rounded-lg"
            >
              {loading ? "Sending..." : "Reset Password"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-bold mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 mb-4">
              We sent a reset code to {email}. Enter the 4-digit code.
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(e.target.value, index)}
                  className="w-12 h-12 text-center text-lg font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
            <button
              onClick={handleVerifyCode}
              className="bg-[#012E89] text-white w-full py-2 rounded-lg"
            >
              Continue
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-bold mb-2">Set a new password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Create a new password. Ensure it differs from previous ones.
            </p>

            <div className="text-left mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border rounded-lg w-full p-2"
              />
            </div>

            <div className="text-left mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border rounded-lg w-full p-2"
              />
            </div>

            <button
              onClick={handleUpdatePassword}
              disabled={loading}
              className="bg-[#012E89] text-white w-full py-2 rounded-lg"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-bold mb-2 text-green-600">
              🎉 Password Updated!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been successfully reset. You can now sign in
              with your new password.
            </p>
            <button
              onClick={handleGoToLogin}
              className="bg-[#012E89] text-white w-full py-2 rounded-lg"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>  
  );
}
