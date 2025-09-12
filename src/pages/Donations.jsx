import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { User, Upload, CheckCircle } from "lucide-react";

export default function Donations() {
    const [step, setStep] = useState("card"); 
    // steps: "card" | "form" | "status" | "success" | "dashboard"

    return (
        <div className="flex-1 flex justify-center py-10 mt-14 items-center">
            {/* Step 1: Card */}
            {step === "card" && (
                <Card className="w-[320px] shadow-md rounded-2xl border border-gray-200">
                    <CardContent className="flex flex-col items-center text-center p-6">
                        <div className="w-14 h-14 flex items-center justify-center bg-green-100 rounded-full mb-4">
                            <User className="w-7 h-7 text-green-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">Individual Account</h2>
                        <p className="text-sm text-gray-500 mt-1">For personal fundraising and individual donors</p>
                        <ul className="text-sm text-gray-600 mt-3 space-y-1">
                            <li>• BVN Verification</li>
                            <li>• Bank Account Details</li>
                            <li>• Government ID Upload</li>
                        </ul>
                        <Button className="mt-6" onClick={() => setStep("form")}>Start Verification</Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Form */}
            {step === "form" && (
                <Card className="w-full max-w-3xl shadow-md rounded-2xl border border-gray-200">
                    <CardHeader className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-full">
                                <User className="text-green-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Individual KYC Verification</CardTitle>
                                <p className="text-sm text-gray-500">Complete your verification details</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setStep("card")}>← Back</Button>
                    </CardHeader>

                    <CardContent className="p-6 space-y-8">
                        {/* Personal Information */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>First Name</Label>
                                    <Input placeholder="Enter first name" />
                                </div>
                                <div>
                                    <Label>Last Name</Label>
                                    <Input placeholder="Enter last name" />
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <Input placeholder="Enter email address" />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Address</Label>
                                    <Input placeholder="Enter your full address" />
                                </div>
                                <div>
                                    <Label>BVN (Bank Verification Number)</Label>
                                    <Input placeholder="Enter 11-digit BVN" />
                                </div>
                            </div>
                        </section>

                        {/* Bank Details */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Bank Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Bank Name</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select your bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gtbank">GTBank</SelectItem>
                                            <SelectItem value="access">Access Bank</SelectItem>
                                            <SelectItem value="zenith">Zenith Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Account Number</Label>
                                    <Input placeholder="Enter account number" />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Account Name</Label>
                                    <Input placeholder="Will be auto-filled" disabled />
                                </div>
                            </div>
                        </section>

                        {/* Government ID */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Government ID</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>ID Type</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select ID type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="nin">NIN</SelectItem>
                                            <SelectItem value="passport">Passport</SelectItem>
                                            <SelectItem value="drivers">Driver’s License</SelectItem>
                                            <SelectItem value="voters">Voter’s Card</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>

                        {/* Upload Document */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Upload ID Document</h3>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600">
                                    Select a file or drag and drop here <br />
                                    <span className="text-gray-400">JPG, PNG or PDF. File size no more than 10MB</span>
                                </p>
                            </div>
                        </section>

                        {/* Submit */}
                        <div className="flex justify-center">
                            <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg" onClick={() => setStep("status")}>
                                Complete Verification
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Verification Status */}
            {step === "status" && (
                <Card className="p-6 w-full max-w-2xl mx-auto rounded-2xl shadow-md space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="font-semibold text-lg flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 p-2 rounded-full">👤</span>
                                Verification Status
                            </h2>
                            <p className="text-sm text-gray-500">Individual Account verification progress</p>
                        </div>
                        <button className="px-4 py-1 border rounded-md" onClick={() => setStep("form")}>← Back</button>
                    </div>

                    {/* Progress */}
                    <div className="border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium">Overall Verification Status</h3>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">In Progress</span>
                        </div>
                        <p className="text-sm text-gray-500">1 of 4 verification levels completed</p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: "25%" }}></div>
                        </div>
                        <p className="text-right text-xs text-gray-500">25%</p>
                    </div>

                    {/* Steps */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-green-100 text-green-600 p-2 rounded-full">👤</span>
                                <div>
                                    <p className="font-medium">Personal Information</p>
                                    <p className="text-sm text-gray-500">Basic personal details and contact info</p>
                                </div>
                            </div>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Verified ✓</span>
                        </div>

                        <div className="flex justify-between items-center border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-yellow-100 text-yellow-600 p-2 rounded-full">📄</span>
                                <div>
                                    <p className="font-medium">Identity Verification</p>
                                    <p className="text-sm text-gray-500">Government-issued ID verification</p>
                                </div>
                            </div>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Pending ⏳</span>
                        </div>

                        <div className="flex justify-between items-center border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-yellow-100 text-yellow-600 p-2 rounded-full">🛡</span>
                                <div>
                                    <p className="font-medium">BVN Verification</p>
                                    <p className="text-sm text-gray-500">Bank Verification Number validation</p>
                                </div>
                            </div>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Pending ⏳</span>
                        </div>

                        <div className="flex justify-between items-center border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-yellow-100 text-yellow-600 p-2 rounded-full">🏦</span>
                                <div>
                                    <p className="font-medium">Bank Account Verification</p>
                                    <p className="text-sm text-gray-500">Bank account details for settlements</p>
                                </div>
                            </div>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Pending ⏳</span>
                        </div>
                    </div>

                    <div className="flex justify-center mt-6">
                        <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg" onClick={() => setStep("success")}>
                            Finish Verification
                        </Button>
                    </div>
                </Card>
            )}

            {/* Step 4: Success */}
            {step === "success" && (
                <Card className="w-[360px] shadow-md rounded-2xl border border-gray-200 text-center p-8 space-y-4">
                    <div className="flex justify-center">
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Verification Complete!</h2>
                    <p className="text-sm text-gray-500">Your account has been successfully verified. You can now start accepting donations.</p>
                    <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg" onClick={() => setStep("dashboard")}>
                        Go to Dashboard
                    </Button>
                </Card>
            )}

            {/* Step 5: Donations Dashboard */}
            {step === "dashboard" && (
                <div className="w-full max-w-5xl space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold">Donations Dashboard</h2>
                            <p className="text-gray-500 text-sm">Individual Account • Verified</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setStep("success")}>← Back</Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4">
                            <h4 className="text-gray-500 text-sm">Total Donations</h4>
                            <p className="text-xl font-bold">₦175,000.00</p>
                            <p className="text-sm text-gray-500">3 donations received</p>
                        </Card>

                        <Card className="p-4">
                            <h4 className="text-gray-500 text-sm">Settlements</h4>
                            <p className="text-xl font-bold">₦140,000.00</p>
                            <p className="text-sm text-gray-500">2 settlements completed</p>
                        </Card>

                        <Card className="p-4">
                            <h4 className="text-gray-500 text-sm">Pending</h4>
                            <p className="text-xl font-bold">₦100,000.00</p>
                            <p className="text-sm text-gray-500">1 transaction pending</p>
                        </Card>
                    </div>

                    {/* Transaction History */}
                    <div className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-semibold">Transaction History</h3>
                                <p className="text-sm text-gray-500">View all your donation and settlement transactions</p>
                            </div>
                            <Button>Export</Button>
                        </div>

                        <div className="flex space-x-2 mb-4">
                            <Button variant="outline">All Transactions</Button>
                            <Button variant="outline">Donations In</Button>
                            <Button variant="outline">Settlements</Button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border rounded-lg">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3">#</th>
                                        <th className="p-3">Reference</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Donor/Description</th>
                                        <th className="p-3">Purpose</th>
                                        <th className="p-3">Amount</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan="9" className="text-center p-6 text-gray-400">No transactions yet</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
