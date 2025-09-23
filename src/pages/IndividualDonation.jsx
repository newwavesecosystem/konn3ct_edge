import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { User, Upload, CheckCircle } from "lucide-react";

import { getBankList, verifyBank, submitKyc, fetchKyc } from "../api/donationApi";
import VerificationStatus from "./VerificationStatus";

export default function IndividualDonation({ onComplete }) {
    const [step, setStep] = useState("card");
    const [banks, setBanks] = useState([]);
    const [accountName, setAccountName] = useState("");
    const [bankCode, setBankCode] = useState(null);
    const [kycStatus, setKycStatus] = useState({});
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        address: "",
        bvn: "",
        account_number: "",
        id_type: "",
        id_document: null
    });

    // 🏦 Fetch bank list
    useEffect(() => {
        getBankList().then(setBanks).catch(console.error);
        fetchKyc().then(setKycStatus).catch(console.error);
    }, []);


    // 🧾 Fetch current KYC status on "status" step
    useEffect(() => {
        if (step === "status") {
            fetchKyc().then(setKycStatus).catch(console.error);
        }
    }, [step]);

    // ✅ Auto verify bank account
    useEffect(() => {
        if (formData.account_number.length === 10 && bankCode !== null) {
            verifyBank(formData.account_number, bankCode.code)
                .then(res => {
                    if (res.success) setAccountName(res.data.account_name);
                    else setAccountName("");
                })
                .catch(() => setAccountName(""));
        }
    }, [formData.account_number, bankCode]);

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleSubmit = async () => {
        try {
            const fd = new FormData();
            Object.entries(formData).forEach(([key, val]) => fd.append(key, val));
            fd.append("bank_code", bankCode?.code); // Append bank code separately
            fd.append("bank_name", bankCode?.name); // Append bank name separately
            fd.append("bank_account_name", accountName); // Append account name separately
            fd.append("bank_account_number", formData.account_number); // Append account number separately
            fd.append("type", "individual"); // Append ID type separately
            const res = await submitKyc(fd);
            if (res.success) onComplete();
            else alert(res.message || "KYC failed");
        } catch (err) {
            console.error(err);
            alert("Error submitting KYC");
        }
    };

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
                                    <Input value={formData.first_name} onChange={e => handleChange("first_name", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Last Name</Label>
                                    <Input value={formData.last_name} onChange={e => handleChange("last_name", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <Input value={formData.email} onChange={e => handleChange("email", e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Address</Label>
                                    <Input value={formData.address} onChange={e => handleChange("address", e.target.value)} />
                                </div>
                                <div>
                                    <Label>BVN</Label>
                                    <Input value={formData.bvn} onChange={e => handleChange("bvn", e.target.value)} />
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
                                        <SelectContent>
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
                                    <Input value={formData.account_number} onChange={e => handleChange("account_number", e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Account Name</Label>
                                    <Input value={accountName} placeholder="Will Be Auto-filled" disabled />
                                </div>
                            </div>
                        </section>

                        {/* Government ID */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Government ID</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>ID Type</Label>
                                    <Select
                                        value={formData.id_type} // bind state
                                        onValueChange={v => handleChange("id_type", v)}
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


                        {/* Upload Document */}
                        <section>
                            <h3 className="text-md font-semibold mb-4">Upload ID Document</h3>
                            <input type="file" onChange={e => handleChange("id_document", e.target.files[0])} />
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
