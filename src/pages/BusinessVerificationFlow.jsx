import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Building2, CheckCircle } from "lucide-react";

import { getBankList, verifyBank, submitBusinessKyc, fetchKyc } from "../api/donationApi";
import VerificationStatus from "./VerificationStatus";

export default function BusinessVerificationFlow({ onComplete }) {
    const [step, setStep] = useState("card");
    const [banks, setBanks] = useState([]);
    const [bankCode, setBankCode] = useState(null);
    const [accountName, setAccountName] = useState("");
    const [kycStatus, setKycStatus] = useState({});
    const [formData, setFormData] = useState({
        companyName: "",
        companyEmail: "",
        companyPhone: "",
        companyAddress: "",
        taxId: "",
        directorFirstName: "",
        directorLastName: "",
        directorEmail: "",
        directorPhone: "",
        directorBvn: "",
        directorIdType: "",
        directorIdFile: null,
        bankAccountNumber: "",
    });

    // 🏦 Fetch bank list & KYC status on mount
    useEffect(() => {
        getBankList().then(setBanks).catch(console.error);
        fetchKyc().then(setKycStatus).catch(console.error);
    }, []);

    // 🧾 Refresh KYC status on "status" step
    useEffect(() => {
        if (step === "status") {
            fetchKyc().then(setKycStatus).catch(console.error);
        }
    }, [step]);

    // ✅ Auto verify bank account
    useEffect(() => {
        if (formData.bankAccountNumber?.length === 10 && bankCode !== null) {
            verifyBank(formData.bankAccountNumber, bankCode.code)
                .then(res => {
                    if (res.success) setAccountName(res.data.account_name);
                    else setAccountName("");
                })
                .catch(() => setAccountName(""));
        }
    }, [formData.bankAccountNumber, bankCode]);

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleSubmit = async () => {
        try {
            const fd = new FormData();
            fd.append("company_name", formData.companyName);
            fd.append("company_email", formData.companyEmail);
            fd.append("company_phone", formData.companyPhone);
            fd.append("company_address", formData.companyAddress);
            fd.append("company_taxid", formData.taxId);
            fd.append("first_name", formData.directorFirstName);
            fd.append("last_name", formData.directorLastName);
            fd.append("email", formData.directorEmail);
            fd.append("phone", formData.directorPhone);
            fd.append("bvn", formData.directorBvn);
            fd.append("id_type", formData.directorIdType);
            fd.append("id_document", formData.directorIdFile);
            fd.append("bank_code", bankCode?.code || "");
            fd.append("bank_name", bankCode?.name || "");
            fd.append("bank_account_number", formData.bankAccountNumber || "");
            fd.append("bank_account_name", accountName || "");
            fd.append("type", "corporate");

            const res = await submitBusinessKyc(fd);
            if (res.success) onComplete();
            else alert(res.message || "KYC failed");
        } catch (err) {
            console.error(err);
            alert("Error submitting business KYC");
        }
    };

    return (
        <div className="flex-1 flex justify-center py-10 mt-14 items-center">
            {/* Step 1: Card */}
            {step === "card" && (
                <Card className="w-[320px] shadow-md rounded-2xl border border-gray-200">
                    <CardContent className="flex flex-col items-center text-center p-6">
                        <div className="w-14 h-14 flex items-center justify-center bg-green-100 rounded-full mb-4">
                            <Building2 className="w-7 h-7 text-green-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">Business Account</h2>
                        <p className="text-sm text-gray-500 mt-1">For registered businesses and organizations</p>
                        <ul className="text-sm text-gray-600 mt-3 space-y-1">
                            <li>• Company Verification</li>
                            <li>• Director Information</li>
                            <li>• Bank Account Verification</li>
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
                                <Building2 className="text-green-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Business KYC Verification</CardTitle>
                                <p className="text-sm text-gray-500">Complete your company, director, and bank details</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setStep("card")}>← Back</Button>
                    </CardHeader>

                    <CardContent className="p-6 space-y-8">
                        {/* Company Information */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Company Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Company Name</Label>
                                    <Input value={formData.companyName} onChange={e => handleChange("companyName", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Company Email</Label>
                                    <Input value={formData.companyEmail} onChange={e => handleChange("companyEmail", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Company Phone</Label>
                                    <Input value={formData.companyPhone} onChange={e => handleChange("companyPhone", e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Company Address</Label>
                                    <Input value={formData.companyAddress} onChange={e => handleChange("companyAddress", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Tax ID</Label>
                                    <Input value={formData.taxId} onChange={e => handleChange("taxId", e.target.value)} />
                                </div>
                            </div>
                        </section>

                        {/* Director Information */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Director Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>First Name</Label>
                                    <Input value={formData.directorFirstName} onChange={e => handleChange("directorFirstName", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Last Name</Label>
                                    <Input value={formData.directorLastName} onChange={e => handleChange("directorLastName", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <Input value={formData.directorEmail} onChange={e => handleChange("directorEmail", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Phone</Label>
                                    <Input value={formData.directorPhone} onChange={e => handleChange("directorPhone", e.target.value)} />
                                </div>
                                <div>
                                    <Label>BVN</Label>
                                    <Input value={formData.directorBvn} onChange={e => handleChange("directorBvn", e.target.value)} />
                                </div>
                                <div>
                                    <Select
                                        value={formData.directorIdType}
                                        onValueChange={v => handleChange("directorIdType", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select ID type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NIN">NIN</SelectItem>
                                            <SelectItem value="Passport">Passport</SelectItem>
                                            <SelectItem value="Driver’s License">Driver’s License</SelectItem>
                                            <SelectItem value="Voter’s Card">Voter’s Card</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>

                        {/* Bank Details */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Bank Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Bank</Label>
                                    <Select
                                        value={bankCode?.name}
                                        onValueChange={v => setBankCode(v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select your bank" />
                                        </SelectTrigger>
                                        <SelectContent className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-2">
                                            <div className="grid grid-cols-2 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2">
                                                {banks.map(bank => (
                                                    <SelectItem key={bank.code} value={bank} >
                                                        <div className="!static whitespace-normal text-sm px-2 py-1">
                                                            {bank.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Account Number</Label>
                                    <Input
                                        value={formData.bankAccountNumber}
                                        onChange={e => handleChange("bankAccountNumber", e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Account Name</Label>
                                    <Input value={accountName} placeholder="Will Be Auto-filled" disabled />
                                </div>
                            </div>
                        </section>

                        {/* Upload Document */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Upload Director’s ID</h3>
                            <input type="file" onChange={e => handleChange("directorIdFile", e.target.files[0])} />
                        </section>

                        <div className="flex justify-center">
                            <Button onClick={handleSubmit}>Complete Verification</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
