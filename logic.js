import { product_data, MAX_ENTRY_AGE, MAX_RENEWAL_AGE, MAX_STBH } from './data.js';

let supplementaryInsuredCount = 0;
let currentMainProductState = { product: null, age: null };

document.addEventListener('DOMContentLoaded', () => {
    initPerson(document.getElementById('main-person-container'), 'main');
    initMainProductLogic();
    initSupplementaryButton();
    initSummaryModal();
    attachGlobalListeners();
    calculateAll();
});

function attachGlobalListeners() {
    const allInputs = 'input, select';
    document.body.addEventListener('change', (e) => {
        const checkboxSelectors = [
            '.health-scl-checkbox',
            '.bhn-checkbox',
            '.accident-checkbox',
            '.hospital-support-checkbox',
            '.waiver-premium-checkbox'
        ];
        if (checkboxSelectors.some(selector => e.target.matches(selector))) {
            const section = e.target.closest('.product-section');
            const options = section.querySelector('.product-options');
            if (e.target.checked && !e.target.disabled) {
                options.classList.remove('hidden');
            } else {
                options.classList.add('hidden');
            }
            calculateAll();
        } else if (e.target.matches(allInputs)) {
            validateInput(e.target);
            restrictMainProductOptions();
            calculateAll();
        }
    });
    document.body.addEventListener('input', (e) => {
        if (e.target.matches('input[type="text"]') && !e.target.classList.contains('dob-input') && !e.target.classList.contains('occupation-input') && !e.target.classList.contains('name-input')) {
            formatNumberInput(e.target);
            calculateAll();
        } else if (e.target.matches('input[type="number"]')) {
            calculateAll();
        }
    });
}

function validateInput(input) {
    const errorElement = input.parentElement.querySelector('.error-message');
    if (input.classList.contains('name-input') && !input.value.trim()) {
        showFieldError(errorElement, 'Vui lòng nhập họ và tên');
    } else if (input.classList.contains('dob-input')) {
        const date = chrono.parseDate(input.value);
        if (!date) {
            showFieldError(errorElement, 'Ngày sinh không hợp lệ, nhập DD/MM/YYYY');
        } else {
            clearFieldError(errorElement);
        }
    } else if (input.classList.contains('occupation-input')) {
        const occupation = product_data.occupations.find(o => o.name === input.value);
        if (!occupation || occupation.group === 0) {
            showFieldError(errorElement, 'Chọn nghề nghiệp từ danh sách');
        } else {
            clearFieldError(errorElement);
        }
    } else if (input.id === 'payment-term') {
        const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
        const minTerm = 4;
        const maxTerm = 100 - mainPersonInfo.age - 1;
        const value = parseInt(input.value, 10);
        if (isNaN(value) || value < minTerm || value > maxTerm) {
            showFieldError(errorElement, `Thời hạn không hợp lệ, từ ${minTerm} đến ${maxTerm}`);
        } else {
            clearFieldError(errorElement);
        }
        input.parentElement.querySelector('.input-hint').textContent = `Nhập từ ${minTerm} đến ${maxTerm}`;
    } else {
        clearFieldError(errorElement);
    }
}

function showFieldError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
    }
}

function clearFieldError(element) {
    if (element) {
        element.textContent = '';
        element.classList.add('hidden');
    }
}

function restrictMainProductOptions() {
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    const mainProductSelect = document.getElementById('main-product');
    const options = mainProductSelect.querySelectorAll('option');
    const paymentTermContainer = document.getElementById('payment-term-container');
    const abuvTermContainer = document.getElementById('abuv-term-container');

    options.forEach(option => {
        if (option.value === '') return;
        const product = option.value;
        let isEligible = true;

        if (product === 'TRON_TAM_AN') {
            if (mainPersonInfo.riskGroup === 4 || 
                (mainPersonInfo.gender === 'Nam' && mainPersonInfo.age < 12) || 
                (mainPersonInfo.gender === 'Nữ' && mainPersonInfo.age < 28) ||
                mainPersonInfo.age > 60) {
                isEligible = false;
            }
        } else if (product === 'AN_BINH_UU_VIET') {
            const term = parseInt(document.getElementById('abuv-term')?.value || '15', 10);
            if ((mainPersonInfo.gender === 'Nam' && mainPersonInfo.age < 12) || 
                (mainPersonInfo.gender === 'Nữ' && mainPersonInfo.age < 28) ||
                (term === 5 && mainPersonInfo.age > 65) ||
                (term === 10 && mainPersonInfo.age > 60) ||
                (term === 15 && mainPersonInfo.age > 55)) {
                isEligible = false;
            }
        } else if (mainPersonInfo.age > MAX_ENTRY_AGE[product]) {
            isEligible = false;
        }

        option.disabled = !isEligible;
        option.classList.toggle('hidden', !isEligible);
    });

    if (mainProductSelect.value === 'AN_BINH_UU_VIET') {
        paymentTermContainer.classList.add('hidden');
        abuvTermContainer.classList.remove('hidden');
    } else {
        paymentTermContainer.classList.remove('hidden');
        abuvTermContainer.classList.add('hidden');
    }
}

function initPerson(container, personId, isSupp = false) {
    if (!container) return;
    container.dataset.personId = personId;

    initDateFormatter(container.querySelector('.dob-input'));
    initOccupationAutocomplete(container.querySelector('.occupation-input'), container);
    
    const suppProductsContainer = isSupp ? container.querySelector('.supplementary-products-container') : document.querySelector('#main-supp-container .supplementary-products-container');
    suppProductsContainer.innerHTML = generateSupplementaryProductsHtml(personId);
    
    const sclSection = suppProductsContainer.querySelector('.health-scl-section');
    if (sclSection) {
        const mainCheckbox = sclSection.querySelector('.health-scl-checkbox');
        const programSelect = sclSection.querySelector('.health-scl-program');
        const scopeSelect = sclSection.querySelector('.health-scl-scope');
        const outpatientCheckbox = sclSection.querySelector('.health-scl-outpatient');
        const dentalCheckbox = sclSection.querySelector('.health-scl-dental');

        const handleProgramChange = () => {
            const programChosen = programSelect.value !== '';
            outpatientCheckbox.disabled = !programChosen;
            dentalCheckbox.disabled = !programChosen;
            if (!programChosen) {
                outpatientCheckbox.checked = false;
                dentalCheckbox.checked = false;
            }
            calculateAll();
        };

        const handleMainCheckboxChange = () => {
            const isChecked = mainCheckbox.checked && !mainCheckbox.disabled;
            programSelect.disabled = !isChecked;
            scopeSelect.disabled = !isChecked;
            const options = sclSection.querySelector('.product-options');
            options.classList.toggle('hidden', !isChecked);
            if (!isChecked) {
                programSelect.value = '';
                outpatientCheckbox.checked = false;
                dentalCheckbox.checked = false;
            }
            handleProgramChange();
            calculateAll();
        };

        programSelect.addEventListener('change', handleProgramChange);
        mainCheckbox.addEventListener('change', handleMainCheckboxChange);
    }

    ['bhn', 'accident', 'hospital-support', 'waiver-premium'].forEach(product => {
        const section = suppProductsContainer.querySelector(`.${product}-section`);
        if (section) {
            const checkbox = section.querySelector(`.${product}-checkbox`);
            const handleCheckboxChange = () => {
                const isChecked = checkbox.checked && !checkbox.disabled;
                const options = section.querySelector('.product-options');
                options.classList.toggle('hidden', !isChecked);
                calculateAll();
            };
            checkbox.addEventListener('change', handleCheckboxChange);
        }
    });

    // Restrict supplementary product visibility based on age
    restrictSupplementaryProducts(container);
}

function restrictSupplementaryProducts(container) {
    const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
    const suppProducts = ['health-scl', 'bhn', 'accident', 'hospital-support', 'waiver-premium'];
    
    suppProducts.forEach(product => {
        const section = container.querySelector(`.${product}-section`);
        if (section) {
            const checkbox = section.querySelector(`.${product}-checkbox`);
            const isEligible = personInfo.age <= MAX_ENTRY_AGE[product];
            section.classList.toggle('hidden', !isEligible);
            checkbox.disabled = !isEligible;
            if (!isEligible) {
                checkbox.checked = false;
                section.querySelector('.product-options').classList.add('hidden');
            }
        }
    });
}

function initMainProductLogic() {
    document.getElementById('main-product').addEventListener('change', () => {
        restrictMainProductOptions();
        calculateAll();
    });
    document.getElementById('dob-main').addEventListener('input', () => {
        updateTargetAge();
        restrictMainProductOptions();
        calculateAll();
    });
    document.getElementById('abuv-term')?.addEventListener('change', () => {
        updateTargetAge();
        restrictMainProductOptions();
        calculateAll();
    });
    document.getElementById('payment-term')?.addEventListener('change', () => {
        updateTargetAge();
        calculateAll();
    });
    document.getElementById('payment-frequency')?.addEventListener('change', calculateAll);
}

function initSupplementaryButton() {
    document.getElementById('add-supp-insured-btn').addEventListener('click', () => {
        supplementaryInsuredCount++;
        const personId = `supp${supplementaryInsuredCount}`;
        const container = document.getElementById('supplementary-insured-container');
        const newPersonDiv = document.createElement('div');
        newPersonDiv.className = 'person-container space-y-6 bg-gray-100 p-4 rounded-lg mt-4';
        newPersonDiv.id = `person-container-${personId}`;
        newPersonDiv.innerHTML = generateSupplementaryPersonHtml(personId, supplementaryInsuredCount);
        container.appendChild(newPersonDiv);
        initPerson(newPersonDiv, personId, true);
        calculateAll();
    });
}

function initSummaryModal() {
    const modal = document.getElementById('summary-modal');
    document.getElementById('view-summary-btn').addEventListener('click', generateSummaryTable);
    document.getElementById('close-summary-modal-btn').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    updateTargetAge();
}

function updateTargetAge() {
    const mainPersonContainer = document.getElementById('main-person-container');
    const mainPersonInfo = getCustomerInfo(mainPersonContainer, true);
    const mainProduct = mainPersonInfo.mainProduct;
    const targetAgeInput = document.getElementById('target-age-input');

    if (mainProduct === 'TRON_TAM_AN') {
        targetAgeInput.value = mainPersonInfo.age + 10 - 1;
        targetAgeInput.disabled = true;
    } else if (mainProduct === 'AN_BINH_UU_VIET') {
        const termSelect = document.getElementById('abuv-term');
        const term = termSelect ? parseInt(termSelect.value || '15', 10) : 15;
        targetAgeInput.value = mainPersonInfo.age + term - 1;
        targetAgeInput.disabled = true;
    } else {
        const paymentTermInput = document.getElementById('payment-term');
        const paymentTerm = paymentTermInput ? parseInt(paymentTermInput.value, 10) || 0 : 0;
        targetAgeInput.disabled = false;
        targetAgeInput.min = mainPersonInfo.age + paymentTerm - 1;
        if (!targetAgeInput.value || parseInt(targetAgeInput.value, 10) < mainPersonInfo.age + paymentTerm - 1) {
            targetAgeInput.value = mainPersonInfo.age + paymentTerm - 1;
        }
    }
}

function calculateAll() {
    const mainPersonContainer = document.getElementById('main-person-container');
    const mainPersonInfo = getCustomerInfo(mainPersonContainer, true);
    let totalMainFee = 0;
    let totalFee = 0;

    if (mainPersonInfo.mainProduct) {
        totalMainFee = calculateMainProductFee(mainPersonInfo);
        totalFee += totalMainFee;
        document.getElementById('main-fee').textContent = formatCurrency(totalMainFee);
    }

    const suppFees = Array.from(document.querySelectorAll('.person-container')).reduce((sum, container) => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppFee = calculateSupplementaryFee(personInfo);
        totalFee += suppFee;
        const feeDisplay = container.querySelectorAll('.fee-display');
        feeDisplay.forEach(display => {
            display.textContent = formatCurrency(suppFee);
        });
        return sum + suppFee;
    }, 0);

    document.getElementById('total-fee').textContent = formatCurrency(totalFee);
}

function calculateMainProductFee(personInfo) {
    if (!personInfo.mainProduct) return 0;
    const rates = product_data.pul_rates[personInfo.mainProduct];
    const rate = rates.find(r => r.age === personInfo.age)?.[personInfo.gender.toLowerCase()];
    if (!rate) return 0;

    const paymentFrequency = document.getElementById('payment-frequency').value;
    const frequencyFactor = { yearly: 1, quarterly: 0.265, 'semi-annually': 0.52 };
    const term = personInfo.mainProduct === 'AN_BINH_UU_VIET' ? 
        parseInt(document.getElementById('abuv-term')?.value || '15', 10) : 
        parseInt(document.getElementById('payment-term')?.value || '0', 10);
    
    let stbh = parseFormattedNumber(document.getElementById('main-stbh')?.value || '0');
    if (!stbh) stbh = 500000000; // Default STBH if not provided
    let fee = (stbh / 1000) * rate;
    fee = Math.round(fee * frequencyFactor[paymentFrequency] / 1000) * 1000;
    return fee;
}

function calculateSupplementaryFee(personInfo) {
    let totalFee = 0;
    const container = document.querySelector(`[data-person-id="${personInfo.personId}"]`);
    
    if (container.querySelector('.health-scl-checkbox')?.checked) {
        const program = container.querySelector('.health-scl-program')?.value;
        const scope = container.querySelector('.health-scl-scope')?.value;
        const outpatient = container.querySelector('.health-scl-outpatient')?.checked;
        const dental = container.querySelector('.health-scl-dental')?.checked;
        
        if (program && scope) {
            const rate = product_data.health_scl_rates[scope].find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.[program] || 0;
            totalFee += rate;
            if (outpatient) {
                totalFee += product_data.health_scl_rates.outpatient.find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.[program] || 0;
            }
            if (dental) {
                totalFee += product_data.health_scl_rates.dental.find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.[program] || 0;
            }
        }
    }

    if (container.querySelector('.bhn-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.bhn-stbh')?.value);
        if (stbh > MAX_STBH.bhn) {
            showFieldError(container.querySelector('.bhn-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.bhn)}`);
            return 0;
        }
        const rate = product_data.bhn_rates.find(r => r.age === personInfo.age)?.[personInfo.gender.toLowerCase()] || 0;
        totalFee += (stbh / 1000) * rate;
    }

    if (container.querySelector('.accident-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.accident-stbh')?.value);
        if (stbh > MAX_STBH.accident) {
            showFieldError(container.querySelector('.accident-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.accident)}`);
            return 0;
        }
        const rate = product_data.accident_rates[personInfo.riskGroup] || 0;
        totalFee += (stbh / 1000) * rate;
    }

    if (container.querySelector('.hospital-support-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.hospital-support-stbh')?.value);
        if (stbh > MAX_STBH.hospital_support) {
            showFieldError(container.querySelector('.hospital-support-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.hospital_support)}`);
            return 0;
        }
        const rate = product_data.hospital_fee_support_rates.find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.rate || 0;
        totalFee += (stbh / 100) * rate;
    }

    if (container.querySelector('.waiver-premium-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.waiver-premium-stbh')?.value);
        if (stbh > MAX_STBH.waiver_premium) {
            showFieldError(container.querySelector('.waiver-premium-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.waiver_premium)}`);
            return 0;
        }
        const rate = product_data.waiver_premium_rates.find(r => r.age === personInfo.age)?.[personInfo.gender.toLowerCase()] || 0;
        totalFee += (stbh / 1000) * rate;
    }

    const paymentFrequency = document.getElementById('payment-frequency').value;
    const frequencyFactor = { yearly: 1, quarterly: 0.265, 'semi-annually': 0.52 };
    return Math.round(totalFee * frequencyFactor[paymentFrequency] / 1000) * 1000;
}

function getCustomerInfo(container, isMain = false) {
    const dobInput = container.querySelector('.dob-input');
    const date = chrono.parseDate(dobInput?.value);
    const age = date ? Math.floor((new Date(2025, 7, 9) - date) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    const occupation = product_data.occupations.find(o => o.name === container.querySelector('.occupation-input')?.value);
    
    return {
        personId: container.dataset.personId,
        name: container.querySelector('.name-input')?.value || '',
        age,
        gender: container.querySelector('.gender-select')?.value || 'Nam',
        occupation: occupation?.name || '',
        riskGroup: occupation?.group || 0,
        mainProduct: isMain ? document.getElementById('main-product')?.value : null
    };
}

function generateSummaryTable() {
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    const targetAge = parseInt(document.getElementById('target-age-input')?.value, 10) || mainPersonInfo.age;
    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Người Được BH</th>
                    <th>Sản Phẩm</th>
                    <th>Phí Bảo Hiểm</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (mainPersonInfo.mainProduct) {
        const mainFee = calculateMainProductFee(mainPersonInfo);
        tableHtml += `
            <tr>
                <td>${mainPersonInfo.name}</td>
                <td>${mainPersonInfo.mainProduct}</td>
                <td class="text-right">${formatCurrency(mainFee)}</td>
            </tr>
        `;
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppFee = calculateSupplementaryFee(personInfo);
        if (suppFee > 0) {
            tableHtml += `
                <tr>
                    <td>${personInfo.name}</td>
                    <td>Sản phẩm bổ sung</td>
                    <td class="text-right">${formatCurrency(suppFee)}</td>
                </tr>
            `;
        }
    });

    tableHtml += `
        </tbody>
        </table>
        <p class="font-bold mt-4">Lưu ý: Bảng minh họa này chỉ mang tính chất tham khảo và không thay thế hợp đồng bảo hiểm chính thức.</p>
    `;

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bảng Minh Họa Phí Bảo Hiểm</title>
    <style>
        body { font-family: 'Noto Sans', sans-serif; margin: 40px; }
        h1 { text-align: center; color: #1f2937; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 8px; border: 1px solid #d1d5db; }
        th { background-color: #f3f4f6; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <img src="/assets/aia-logo.png" alt="AIA Logo" style="height: 50px; display: block; margin: 0 auto 20px;">
    <h1>Bảng Minh Họa Phí Bảo Hiểm</h1>
    ${tableHtml}
    <div style="margin-top: 20px; text-align: center;" class="no-print">
        <button onclick="window.print()" style="background-color: #D9232D; color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;">In thành PDF</button>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bang_minh_hoa_phi_bao_hiem.html';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Optional: Generate PDF using jsPDF (if LaTeX is not used)
    /*
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('NotoSans');
    doc.addImage('/assets/aia-logo.png', 'PNG', 80, 10, 50, 20);
    doc.setFontSize(16);
    doc.text('Bảng Minh Họa Phí Bảo Hiểm', 105, 40, { align: 'center' });
    doc.autoTable({
        html: '#summary-table table',
        startY: 50,
        theme: 'striped',
        styles: { font: 'NotoSans' }
    });
    doc.text('Lưu ý: Bảng minh họa này chỉ mang tính chất tham khảo và không thay thế hợp đồng bảo hiểm chính thức.', 10, doc.lastAutoTable.finalY + 10);
    doc.save('bang_minh_hoa_phi_bao_hiem.pdf');
    */
}

function formatCurrency(value) {
    if (isNaN(value)) return '0';
    return Math.round(value).toLocaleString('vi-VN');
}

function formatNumberInput(input) {
    if (!input || !input.value) return;
    let value = input.value.replace(/[.,]/g, '');
    if (!isNaN(value) && value.length > 0) {
        input.value = parseInt(value, 10).toLocaleString('vi-VN');
    } else if (input.value !== '') {
        input.value = '';
    }
}

function parseFormattedNumber(formattedString) {
    return parseInt(String(formattedString).replace(/[.,]/g, ''), 10) || 0;
}

function initDateFormatter(input) {
    if (!input) return;
    input.addEventListener('input', () => {
        const date = chrono.parseDate(input.value);
        const ageSpan = input.closest('.person-container').querySelector('.age-span');
        if (date) {
            const age = Math.floor((new Date(2025, 7, 9) - date) / (365.25 * 24 * 60 * 60 * 1000));
            ageSpan.textContent = age;
        } else {
            ageSpan.textContent = '0';
        }
        restrictMainProductOptions();
        restrictSupplementaryProducts(input.closest('.person-container'));
        calculateAll();
    });
}

function initOccupationAutocomplete(input, container) {
    if (!input) return;
    const autocomplete = container.querySelector('.occupation-autocomplete');
    input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        const matches = product_data.occupations.filter(o => o.name.toLowerCase().includes(query));
        autocomplete.innerHTML = matches.map(o => `<div class="autocomplete-item">${o.name}</div>`).join('');
        autocomplete.classList.toggle('hidden', matches.length === 0);
        autocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                input.value = item.textContent;
                const occupation = product_data.occupations.find(o => o.name === item.textContent);
                container.querySelector('.risk-group-span').textContent = occupation.group;
                autocomplete.classList.add('hidden');
                restrictMainProductOptions();
                restrictSupplementaryProducts(container);
                calculateAll();
            });
        });
    });
}

function generateSupplementaryPersonHtml(personId, count) {
    return `
        <button class="w-full text-right text-sm text-red-600 font-semibold" onclick="this.closest('.person-container').remove(); calculateAll();">Xóa NĐBH này</button>
        <h3 class="text-lg font-bold text-gray-700 mb-2 border-t pt-4">NĐBH Bổ Sung ${count}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label for="name-${personId}" class="font-medium text-gray-700 block mb-1">Họ và Tên</label>
                <input type="text" id="name-${personId}" class="form-input name-input" placeholder="Trần Thị B">
                <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                <p class="input-hint text-gray-500 text-sm mt-1">Nhập họ và tên đầy đủ</p>
            </div>
            <div>
                <label for="dob-${personId}" class="font-medium text-gray-700 block mb-1">Ngày sinh</label>
                <input type="text" id="dob-${personId}" class="form-input dob-input" placeholder="DD/MM/YYYY">
                <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                <p class="input-hint text-gray-500 text-sm mt-1">Nhập theo DD/MM/YYYY</p>
            </div>
            <div>
                <label for="gender-${personId}" class="font-medium text-gray-700 block mb-1">Giới tính</label>
                <select id="gender-${personId}" class="form-select gender-select">
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                </select>
            </div>
            <div class="flex items-end space-x-4">
                <p class="text-lg">Tuổi: <span id="age-${personId}" class="font-bold text-aia-red age-span">0</span></p>
            </div>
            <div class="relative">
                <label for="occupation-input-${personId}" class="font-medium text-gray-700 block mb-1">Nghề nghiệp</label>
                <input type="text" id="occupation-input-${personId}" class="form-input occupation-input" placeholder="Gõ để tìm nghề nghiệp...">
                <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                <p class="input-hint text-gray-500 text-sm mt-1">Chọn nghề nghiệp từ danh sách</p>
                <div class="occupation-autocomplete absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 hidden max-h-60 overflow-y-auto"></div>
            </div>
            <div class="flex items-end space-x-4">
                <p class="text-lg">Nhóm nghề: <span id="risk-group-${personId}" class="font-bold text-aia-red risk-group-span">...</span></p>
            </div>
        </div>
        <div class="mt-4">
            <h4 class="text-md font-semibold text-gray-800 mb-2">Sản phẩm bổ sung cho người này</h4>
            <div class="supplementary-products-container space-y-6"></div>
        </div>
    `;
}

function generateSupplementaryProductsHtml(personId) {
    return `
        <div class="product-section health-scl-section">
            <label class="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" class="form-checkbox health-scl-checkbox">
                <span class="text-lg font-medium text-gray-800">Sức khỏe Bùng Gia Lực</span>
            </label>
            <div class="product-options hidden mt-3 pl-8 space-y-4 border-l-2 border-gray-200">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="font-medium text-gray-700 block mb-1">Quyền lợi chính (Bắt buộc)</label>
                        <select class="form-select health-scl-program" disabled>
                            <option value="">-- Chọn chương trình --</option>
                            <option value="co_ban">Cơ bản</option>
                            <option value="nang_cao">Nâng cao</option>
                            <option value="toan_dien">Toàn diện</option>
                            <option value="hoan_hao">Hoàn hảo</option>
                        </select>
                    </div>
                    <div>
                        <label class="font-medium text-gray-700 block mb-1">Phạm vi địa lý</label>
                        <select class="form-select health-scl-scope" disabled>
                            <option value="main_vn">Việt Nam</option>
                            <option value="main_global">Toàn cầu (trừ Hoa Kỳ)</option>
                        </select>
                    </div>
                </div>
                <div>
                    <span class="font-medium text-gray-700 block mb-2">Quyền lợi tùy chọn:</span>
                    <div class="space-y-2">
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="form-checkbox health-scl-outpatient" disabled>
                            <span>Điều trị ngoại trú</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" class="form-checkbox health-scl-dental" disabled>
                            <span>Chăm sóc nha khoa</span>
                        </label>
                    </div>
                </div>
                <div class="text-right font-semibold text-aia-red fee-display min-h-[1.5rem]"></div>
            </div>
        </div>
        <div class="product-section bhn-section">
            <label class="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" class="form-checkbox bhn-checkbox">
                <span class="text-lg font-medium text-gray-800">Bệnh Hiểm Nghèo 2.0</span>
            </label>
            <div class="product-options hidden mt-3 pl-8 space-y-3 border-l-2 border-gray-200">
                <div>
                    <label class="font-medium text-gray-700 block mb-1">Số tiền bảo hiểm (STBH)</label>
                    <input type="text" class="form-input bhn-stbh" placeholder="VD: 500.000.000">
                    <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                </div>
                <div class="text-right font-semibold text-aia-red fee-display min-h-[1.5rem]"></div>
            </div>
        </div>
        <div class="product-section accident-section">
            <label class="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" class="form-checkbox accident-checkbox">
                <span class="text-lg font-medium text-gray-800">Bảo hiểm Tai nạn</span>
            </label>
            <div class="product-options hidden mt-3 pl-8 space-y-3 border-l-2 border-gray-200">
                <div>
                    <label class="font-medium text-gray-700 block mb-1">Số tiền bảo hiểm (STBH)</label>
                    <input type="text" class="form-input accident-stbh" placeholder="VD: 200.000.000">
                    <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                </div>
                <div class="text-right font-semibold text-aia-red fee-display min-h-[1.5rem]"></div>
            </div>
        </div>
        <div class="product-section hospital-support-section">
            <label class="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" class="form-checkbox hospital-support-checkbox">
                <span class="text-lg font-medium text-gray-800">Hỗ trợ chi phí nằm viện</span>
            </label>
            <div class="product-options hidden mt-3 pl-8 space-y-3 border-l-2 border-gray-200">
                <div>
                    <label class="font-medium text-gray-700 block mb-1">Số tiền hỗ trợ/ngày</label>
                    <input type="text" class="form-input hospital-support-stbh" placeholder="VD: 300.000">
                    <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                    <p class="hospital-support-validation text-sm text-gray-500 mt-1"></p>
                </div>
                <div class="text-right font-semibold text-aia-red fee-display min-h-[1.5rem]"></div>
            </div>
        </div>
        <div class="product-section waiver-premium-section">
            <label class="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" class="form-checkbox waiver-premium-checkbox">
                <span class="text-lg font-medium text-gray-800">Miễn đóng phí 3.0</span>
            </label>
            <div class="product-options hidden mt-3 pl-8 space-y-3 border-l-2 border-gray-200">
                <div>
                    <label class="font-medium text-gray-700 block mb-1">Số tiền bảo hiểm (STBH)</label>
                    <input type="text" class="form-input waiver-premium-stbh" placeholder="VD: 500.000.000">
                    <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                </div>
                <div class="text-right font-semibold text-aia-red fee-display min-h-[1.5rem]"></div>
            </div>
        </div>
    `;
}

function calculateMainProductFee(personInfo) {
    if (!personInfo.mainProduct) return 0;
    const rates = product_data.pul_rates[personInfo.mainProduct];
    const rate = rates.find(r => r.age === personInfo.age)?.[personInfo.gender.toLowerCase()];
    if (!rate) return 0;

    const paymentFrequency = document.getElementById('payment-frequency').value;
    const frequencyFactor = { yearly: 1, quarterly: 0.265, 'semi-annually': 0.52 };
    const term = personInfo.mainProduct === 'AN_BINH_UU_VIET' ? 
        parseInt(document.getElementById('abuv-term')?.value || '15', 10) : 
        parseInt(document.getElementById('payment-term')?.value || '0', 10);
    
    let stbh = parseFormattedNumber(document.getElementById('main-stbh')?.value || '0');
    if (!stbh) stbh = 500000000; // Default STBH if not provided
    let fee = (stbh / 1000) * rate;
    fee = Math.round(fee * frequencyFactor[paymentFrequency] / 1000) * 1000;
    return fee;
}

function calculateSupplementaryFee(personInfo) {
    let totalFee = 0;
    const container = document.querySelector(`[data-person-id="${personInfo.personId}"]`);
    
    if (container.querySelector('.health-scl-checkbox')?.checked) {
        const program = container.querySelector('.health-scl-program')?.value;
        const scope = container.querySelector('.health-scl-scope')?.value;
        const outpatient = container.querySelector('.health-scl-outpatient')?.checked;
        const dental = container.querySelector('.health-scl-dental')?.checked;
        
        if (program && scope) {
            const rate = product_data.health_scl_rates[scope].find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.[program] || 0;
            totalFee += rate;
            if (outpatient) {
                totalFee += product_data.health_scl_rates.outpatient.find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.[program] || 0;
            }
            if (dental) {
                totalFee += product_data.health_scl_rates.dental.find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.[program] || 0;
            }
        }
    }

    if (container.querySelector('.bhn-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.bhn-stbh')?.value);
        if (stbh > MAX_STBH.bhn) {
            showFieldError(container.querySelector('.bhn-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.bhn)}`);
            return 0;
        }
        const rate = product_data.bhn_rates.find(r => r.age === personInfo.age)?.[personInfo.gender.toLowerCase()] || 0;
        totalFee += (stbh / 1000) * rate;
    }

    if (container.querySelector('.accident-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.accident-stbh')?.value);
        if (stbh > MAX_STBH.accident) {
            showFieldError(container.querySelector('.accident-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.accident)}`);
            return 0;
        }
        const rate = product_data.accident_rates[personInfo.riskGroup] || 0;
        totalFee += (stbh / 1000) * rate;
    }

    if (container.querySelector('.hospital-support-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.hospital-support-stbh')?.value);
        if (stbh > MAX_STBH.hospital_support) {
            showFieldError(container.querySelector('.hospital-support-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.hospital_support)}`);
            return 0;
        }
        const rate = product_data.hospital_fee_support_rates.find(r => personInfo.age >= r.ageMin && personInfo.age <= r.ageMax)?.rate || 0;
        totalFee += (stbh / 100) * rate;
    }

    if (container.querySelector('.waiver-premium-checkbox')?.checked) {
        const stbh = parseFormattedNumber(container.querySelector('.waiver-premium-stbh')?.value);
        if (stbh > MAX_STBH.waiver_premium) {
            showFieldError(container.querySelector('.waiver-premium-stbh').parentElement.querySelector('.error-message'), `STBH tối đa là ${formatCurrency(MAX_STBH.waiver_premium)}`);
            return 0;
        }
        const rate = product_data.waiver_premium_rates.find(r => r.age === personInfo.age)?.[personInfo.gender.toLowerCase()] || 0;
        totalFee += (stbh / 1000) * rate;
    }

    const paymentFrequency = document.getElementById('payment-frequency').value;
    const frequencyFactor = { yearly: 1, quarterly: 0.265, 'semi-annually': 0.52 };
    return Math.round(totalFee * frequencyFactor[paymentFrequency] / 1000) * 1000;
}

function getCustomerInfo(container, isMain = false) {
    const dobInput = container.querySelector('.dob-input');
    const date = chrono.parseDate(dobInput?.value);
    const age = date ? Math.floor((new Date(2025, 7, 9) - date) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    const occupation = product_data.occupations.find(o => o.name === container.querySelector('.occupation-input')?.value);
    
    return {
        personId: container.dataset.personId,
        name: container.querySelector('.name-input')?.value || '',
        age,
        gender: container.querySelector('.gender-select')?.value || 'Nam',
        occupation: occupation?.name || '',
        riskGroup: occupation?.group || 0,
        mainProduct: isMain ? document.getElementById('main-product')?.value : null
    };
}

function generateSummaryTable() {
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    const targetAge = parseInt(document.getElementById('target-age-input')?.value, 10) || mainPersonInfo.age;
    let tableHtml = `
        <table class="w-full border-collapse">
            <thead>
                <tr class="bg-gray-100">
                    <th class="border p-2">Người Được BH</th>
                    <th class="border p-2">Sản Phẩm</th>
                    <th class="border p-2 text-right">Phí Bảo Hiểm</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (mainPersonInfo.mainProduct) {
        const mainFee = calculateMainProductFee(mainPersonInfo);
        tableHtml += `
            <tr>
                <td class="border p-2">${mainPersonInfo.name}</td>
                <td class="border p-2">${mainPersonInfo.mainProduct}</td>
                <td class="border p-2 text-right">${formatCurrency(mainFee)}</td>
            </tr>
        `;
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppFee = calculateSupplementaryFee(personInfo);
        if (suppFee > 0) {
            tableHtml += `
                <tr>
                    <td class="border p-2">${personInfo.name}</td>
                    <td class="border p-2">Sản phẩm bổ sung</td>
                    <td class="border p-2 text-right">${formatCurrency(suppFee)}</td>
                </tr>
            `;
        }
    });

    tableHtml += `
        </tbody>
        </table>
        <p class="font-bold mt-4">Lưu ý: Bảng minh họa này chỉ mang tính chất tham khảo và không thay thế hợp đồng bảo hiểm chính thức.</p>
    `;

    const summaryTable = document.getElementById('summary-table');
    summaryTable.innerHTML = tableHtml;
    document.getElementById('summary-modal').classList.remove('hidden');

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bảng Minh Họa Phí Bảo Hiểm</title>
    <style>
        body { font-family: 'Noto Sans', sans-serif; margin: 40px; }
        h1 { text-align: center; color: #1f2937; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 8px; border: 1px solid #d1d5db; }
        th { background-color: #f3f4f6; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <img src="/assets/aia-logo.png" alt="AIA Logo" style="height: 50px; display: block; margin: 0 auto 20px;">
    <h1>Bảng Minh Họa Phí Bảo Hiểm</h1>
    ${tableHtml}
    <div style="margin-top: 20px; text-align: center;" class="no-print">
        <button onclick="window.print()" style="background-color: #D9232D; color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;">In thành PDF</button>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bang_minh_hoa_phi_bao_hiem.html';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function formatCurrency(value) {
    if (isNaN(value)) return '0';
    return Math.round(value).toLocaleString('vi-VN');
}

function formatNumberInput(input) {
    if (!input || !input.value) return;
    let value = input.value.replace(/[.,]/g, '');
    if (!isNaN(value) && value.length > 0) {
        input.value = parseInt(value, 10).toLocaleString('vi-VN');
    } else if (input.value !== '') {
        input.value = '';
    }
}

function parseFormattedNumber(formattedString) {
    return parseInt(String(formattedString).replace(/[.,]/g, ''), 10) || 0;
}

function initDateFormatter(input) {
    if (!input) return;
    input.addEventListener('input', () => {
        const date = chrono.parseDate(input.value);
        const ageSpan = input.closest('.person-container').querySelector('.age-span');
        if (date) {
            const age = Math.floor((new Date(2025, 7, 9) - date) / (365.25 * 24 * 60 * 60 * 1000));
            ageSpan.textContent = age;
        } else {
            ageSpan.textContent = '0';
        }
        restrictMainProductOptions();
        restrictSupplementaryProducts(input.closest('.person-container'));
        calculateAll();
    });
}

function initOccupationAutocomplete(input, container) {
    if (!input) return;
    const autocomplete = container.querySelector('.occupation-autocomplete');
    input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        const matches = product_data.occupations.filter(o => o.name.toLowerCase().includes(query));
        autocomplete.innerHTML = matches.map(o => `<div class="autocomplete-item">${o.name}</div>`).join('');
        autocomplete.classList.toggle('hidden', matches.length === 0);
        autocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                input.value = item.textContent;
                const occupation = product_data.occupations.find(o => o.name === item.textContent);
                container.querySelector('.risk-group-span').textContent = occupation.group;
                autocomplete.classList.add('hidden');
                restrictMainProductOptions();
                restrictSupplementaryProducts(container);
                calculateAll();
            });
        });
    });
}

function generateSupplementaryPersonHtml(personId, count) {
    return `
        <button class="w-full text-right text-sm text-red-600 font-semibold" onclick="this.closest('.person-container').remove(); calculateAll();">Xóa NĐBH này</button>
        <h3 class="text-lg font-bold text-gray-700 mb-2 border-t pt-4">NĐBH Bổ Sung ${count}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label for="name-${personId}" class="font-medium text-gray-700 block mb-1">Họ và Tên</label>
                <input type="text" id="name-${personId}" class="form-input name-input" placeholder="Trần Thị B">
                <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                <p class="input-hint text-gray-500 text-sm mt-1">Nhập họ và tên đầy đủ</p>
            </div>
            <div>
                <label for="dob-${personId}" class="font-medium text-gray-700 block mb-1">Ngày sinh</label>
                <input type="text" id="dob-${personId}" class="form-input dob-input" placeholder="DD/MM/YYYY">
                <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                <p class="input-hint text-gray-500 text-sm mt-1">Nhập theo DD/MM/YYYY</p>
            </div>
            <div>
                <label for="gender-${personId}" class="font-medium text-gray-700 block mb-1">Giới tính</label>
                <select id="gender-${personId}" class="form-select gender-select">
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                </select>
            </div>
            <div class="flex items-end space-x-4">
                <p class="text-lg">Tuổi: <span id="age-${personId}" class="font-bold text-aia-red age-span">0</span></p>
            </div>
            <div class="relative">
                <label for="occupation-input-${personId}" class="font-medium text-gray-700 block mb-1">Nghề nghiệp</label>
                <input type="text" id="occupation-input-${personId}" class="form-input occupation-input" placeholder="Gõ để tìm nghề nghiệp...">
                <p class="error-message text-red-600 text-sm mt-1 hidden"></p>
                <p class="input-hint text-gray-500 text-sm mt-1">Chọn nghề nghiệp từ danh sách</p>
                <div class="occupation-autocomplete absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 hidden max-h-60 overflow-y-auto"></div>
            </div>
            <div class="flex items-end space-x-4">
                <p class="text-lg">Nhóm nghề: <span id="risk-group-${personId}" class="font-bold text-aia-red risk-group-span">...</span></p>
            </div>
        </div>
        <div class="mt-4">
            <h4 class="text-md font-semibold text-gray-800 mb-2">Sản phẩm bổ sung cho người này</h4>
            <div class="supplementary-products-container space-y-6"></div>
        </div>
    `;
}
function validateAllInputs() {
    let isValid = true;
    document.querySelectorAll('.form-input, .form-select').forEach(input => {
        validateInput(input);
        if (input.parentElement.querySelector('.error-message')?.textContent) {
            isValid = false;
        }
    });
    return isValid;
}

function updateTargetAge() {
    const mainPersonContainer = document.getElementById('main-person-container');
    const mainPersonInfo = getCustomerInfo(mainPersonContainer, true);
    const mainProduct = mainPersonInfo.mainProduct;
    const targetAgeInput = document.getElementById('target-age-input');

    if (mainProduct === 'TRON_TAM_AN') {
        targetAgeInput.value = mainPersonInfo.age + 10 - 1;
        targetAgeInput.disabled = true;
    } else if (mainProduct === 'AN_BINH_UU_VIET') {
        const termSelect = document.getElementById('abuv-term');
        const term = termSelect ? parseInt(termSelect.value || '15', 10) : 15;
        targetAgeInput.value = mainPersonInfo.age + term - 1;
        targetAgeInput.disabled = true;
    } else {
        const paymentTermInput = document.getElementById('payment-term');
        const paymentTerm = paymentTermInput ? parseInt(paymentTermInput.value, 10) || 0 : 0;
        targetAgeInput.disabled = false;
        targetAgeInput.min = mainPersonInfo.age + paymentTerm - 1;
        if (!targetAgeInput.value || parseInt(targetAgeInput.value, 10) < mainPersonInfo.age + paymentTerm - 1) {
            targetAgeInput.value = mainPersonInfo.age + paymentTerm - 1;
        }
    }
    validateInput(targetAgeInput);
}

function handlePaymentFrequencyChange() {
    const paymentFrequency = document.getElementById('payment-frequency').value;
    const frequencyText = {
        yearly: 'Năm',
        quarterly: 'Quý',
        'semi-annually': 'Nửa năm'
    };
    document.getElementById('payment-frequency-display').textContent = frequencyText[paymentFrequency] || 'Năm';
    calculateAll();
}

function initSupplementaryProductLogic(container, personId) {
    const suppProducts = ['health-scl', 'bhn', 'accident', 'hospital-support', 'waiver-premium'];
    suppProducts.forEach(product => {
        const section = container.querySelector(`.${product}-section`);
        if (section) {
            const checkbox = section.querySelector(`.${product}-checkbox`);
            const options = section.querySelector('.product-options');
            const stbhInput = section.querySelector(`.${product}-stbh`);
            
            checkbox?.addEventListener('change', () => {
                options.classList.toggle('hidden', !checkbox.checked || checkbox.disabled);
                if (!checkbox.checked) {
                    if (stbhInput) stbhInput.value = '';
                    section.querySelector('.fee-display').textContent = '';
                }
                calculateAll();
            });

            if (stbhInput) {
                stbhInput.addEventListener('input', () => {
                    formatNumberInput(stbhInput);
                    validateInput(stbhInput);
                    calculateAll();
                });
            }
        }
    });
}

function resetForm() {
    const mainPersonContainer = document.getElementById('main-person-container');
    mainPersonContainer.querySelectorAll('.form-input, .form-select').forEach(input => {
        input.value = '';
        clearFieldError(input.parentElement.querySelector('.error-message'));
    });
    document.getElementById('main-product').value = '';
    document.getElementById('main-stbh').value = '';
    document.getElementById('payment-term').value = '';
    document.getElementById('abuv-term').value = '15';
    document.getElementById('payment-frequency').value = 'yearly';
    document.getElementById('target-age-input').value = '';
    document.getElementById('main-fee').textContent = '0';
    document.getElementById('total-fee').textContent = '0';
    
    const suppContainer = document.getElementById('supplementary-insured-container');
    suppContainer.innerHTML = '';
    supplementaryInsuredCount = 0;
    
    document.querySelectorAll('.supplementary-products-container').forEach(container => {
        container.querySelectorAll('.form-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = false;
            container.querySelectorAll('.product-options').forEach(options => {
                options.classList.add('hidden');
            });
            container.querySelectorAll('.fee-display').forEach(display => {
                display.textContent = '';
            });
        });
    });

    restrictMainProductOptions();
    calculateAll();
}

function generateProductSummary(personInfo, container, isMain = false) {
    let summary = '';
    if (isMain && personInfo.mainProduct) {
        const mainFee = calculateMainProductFee(personInfo);
        summary += `<p><strong>Sản phẩm chính:</strong> ${personInfo.mainProduct} - Phí: ${formatCurrency(mainFee)}</p>`;
    }

    const suppProducts = ['health-scl', 'bhn', 'accident', 'hospital-support', 'waiver-premium'];
    suppProducts.forEach(product => {
        const section = container.querySelector(`.${product}-section`);
        if (section?.querySelector(`.${product}-checkbox`)?.checked) {
            const fee = calculateSupplementaryFee(personInfo);
            summary += `<p><strong>${section.querySelector('span').textContent}:</strong> Phí: ${formatCurrency(fee)}</p>`;
        }
    });

    return summary;
}

function exportToPDF() {
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    let latexContent = `
\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{vietnam}
\\usepackage{geometry}
\\usepackage{graphicx}
\\usepackage{array}
\\usepackage{booktabs}
\\usepackage{fontspec}
\\setmainfont{Noto Sans}

\\geometry{top=2cm, bottom=2cm, left=2cm, right=2cm}
\\begin{document}

\\begin{center}
    \\includegraphics[width=5cm]{/assets/aia-logo.png}\\\\
    \\textbf{\\Large Bảng Minh Họa Phí Bảo Hiểm}
\\end{center}

\\vspace{1cm}

\\begin{tabular}{|p{5cm}|p{5cm}|p{4cm}|}
    \\hline
    \\textbf{Người Được BH} & \\textbf{Sản Phẩm} & \\textbf{Phí Bảo Hiểm} \\\\
    \\hline
`;

    if (mainPersonInfo.mainProduct) {
        const mainFee = calculateMainProductFee(mainPersonInfo);
        latexContent += `${mainPersonInfo.name} & ${mainPersonInfo.mainProduct} & ${formatCurrency(mainFee)} \\\\ \\hline\n`;
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppFee = calculateSupplementaryFee(personInfo);
        if (suppFee > 0) {
            latexContent += `${personInfo.name} & Sản phẩm bổ sung & ${formatCurrency(suppFee)} \\\\ \\hline\n`;
        }
    });

    latexContent += `
\\end{tabular}

\\vspace{1cm}
\\textbf{Lưu ý: Bảng minh họa này chỉ mang tính chất tham khảo và không thay thế hợp đồng bảo hiểm chính thức.}

\\end{document}
    `;

    const blob = new Blob([latexContent], { type: 'text/latex' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bang_minh_hoa_phi_bao_hiem.tex';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Initialize additional event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('reset-form-btn')?.addEventListener('click', resetForm);
    document.getElementById('export-pdf-btn')?.addEventListener('click', exportToPDF);
    document.getElementById('payment-frequency')?.addEventListener('change', handlePaymentFrequencyChange);
    document.querySelectorAll('.person-container').forEach(container => {
        initSupplementaryProductLogic(container, container.dataset.personId);
    });
});
function handleDynamicPersonRemoval() {
    document.querySelectorAll('.person-container').forEach(container => {
        const removeBtn = container.querySelector('button.text-red-600');
        if (removeBtn && container.dataset.personId !== 'main') {
            removeBtn.addEventListener('click', () => {
                container.remove();
                supplementaryInsuredCount = Math.max(0, supplementaryInsuredCount - 1);
                calculateAll();
                updatePersonLabels();
            });
        }
    });
}

function updatePersonLabels() {
    const suppContainers = document.querySelectorAll('#supplementary-insured-container .person-container');
    suppContainers.forEach((container, index) => {
        const header = container.querySelector('h3');
        if (header) {
            header.textContent = `NĐBH Bổ Sung ${index + 1}`;
        }
        container.id = `person-container-supp${index + 1}`;
        container.dataset.personId = `supp${index + 1}`;
    });
}

function validateSTBHInput(input, maxSTBH, product) {
    const errorElement = input.parentElement.querySelector('.error-message');
    const value = parseFormattedNumber(input.value);
    if (value > maxSTBH) {
        showFieldError(errorElement, `STBH tối đa cho ${product} là ${formatCurrency(maxSTBH)}`);
        return false;
    }
    if (value <= 0) {
        showFieldError(errorElement, `STBH phải lớn hơn 0`);
        return false;
    }
    clearFieldError(errorElement);
    return true;
}

function updateSupplementaryFeeDisplay(container, personInfo) {
    const suppProducts = ['health-scl', 'bhn', 'accident', 'hospital-support', 'waiver-premium'];
    suppProducts.forEach(product => {
        const section = container.querySelector(`.${product}-section`);
        if (section && section.querySelector(`.${product}-checkbox`)?.checked) {
            const feeDisplay = section.querySelector('.fee-display');
            const fee = calculateSupplementaryFee(personInfo);
            feeDisplay.textContent = formatCurrency(fee);
        }
    });
}

function generateLatexTableRow(personInfo, isMain = false) {
    let row = '';
    if (isMain && personInfo.mainProduct) {
        const mainFee = calculateMainProductFee(personInfo);
        row += `${personInfo.name.replace('&', '\\&')} & ${personInfo.mainProduct.replace('_', '\\_')} & ${formatCurrency(mainFee)} \\\\ \\hline\n`;
    }
    const container = document.querySelector(`[data-person-id="${personInfo.personId}"]`);
    const suppFee = calculateSupplementaryFee(personInfo);
    if (suppFee > 0) {
        row += `${personInfo.name.replace('&', '\\&')} & Sản phẩm bổ sung & ${formatCurrency(suppFee)} \\\\ \\hline\n`;
    }
    return row;
}

function syncInputValues() {
    document.querySelectorAll('.form-input, .form-select').forEach(input => {
        if (input.classList.contains('dob-input')) {
            const date = chrono.parseDate(input.value);
            if (date) {
                const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                input.value = formattedDate;
            }
        } else if (input.classList.contains('occupation-input')) {
            const occupation = product_data.occupations.find(o => o.name === input.value);
            if (occupation) {
                input.closest('.person-container').querySelector('.risk-group-span').textContent = occupation.group;
            }
        }
    });
}

function handleErrorSummary() {
    const errorSummary = document.getElementById('error-summary');
    if (!errorSummary) return;
    
    const errors = [];
    document.querySelectorAll('.error-message').forEach(error => {
        if (error.textContent && !error.classList.contains('hidden')) {
            errors.push(error.textContent);
        }
    });
    
    if (errors.length > 0) {
        errorSummary.innerHTML = `<div class="text-red-600 font-semibold">${errors.join('<br>')}</div>`;
        errorSummary.classList.remove('hidden');
    } else {
        errorSummary.innerHTML = '';
        errorSummary.classList.add('hidden');
    }
}

function initializeFormValidation() {
    document.querySelectorAll('.form-input, .form-select').forEach(input => {
        input.addEventListener('blur', () => {
            validateInput(input);
            handleErrorSummary();
        });
    });
}

function updateAllFees() {
    const mainPersonContainer = document.getElementById('main-person-container');
    const mainPersonInfo = getCustomerInfo(mainPersonContainer, true);
    let totalFee = 0;

    if (mainPersonInfo.mainProduct) {
        const mainFee = calculateMainProductFee(mainPersonInfo);
        totalFee += mainFee;
        document.getElementById('main-fee').textContent = formatCurrency(mainFee);
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        updateSupplementaryFeeDisplay(container, personInfo);
        totalFee += calculateSupplementaryFee(personInfo);
    });

    document.getElementById('total-fee').textContent = formatCurrency(totalFee);
}

// Re-attach event listeners for dynamic elements
document.addEventListener('DOMContentLoaded', () => {
    handleDynamicPersonRemoval();
    initializeFormValidation();
    document.getElementById('main-product')?.addEventListener('change', () => {
        syncInputValues();
        updateAllFees();
    });
    document.getElementById('add-supp-insured-btn')?.addEventListener('click', () => {
        setTimeout(() => {
            handleDynamicPersonRemoval();
            initializeFormValidation();
            updatePersonLabels();
        }, 0);
    });
});
function optimizeFeeCalculation() {
    const mainPersonContainer = document.getElementById('main-person-container');
    const mainPersonInfo = getCustomerInfo(mainPersonContainer, true);
    let totalFee = 0;
    
    // Cache fee calculations to avoid redundant computations
    const cache = new Map();
    
    if (mainPersonInfo.mainProduct) {
        const cacheKey = `main_${mainPersonInfo.mainProduct}_${mainPersonInfo.age}_${mainPersonInfo.gender}`;
        if (!cache.has(cacheKey)) {
            cache.set(cacheKey, calculateMainProductFee(mainPersonInfo));
        }
        totalFee += cache.get(cacheKey);
        document.getElementById('main-fee').textContent = formatCurrency(cache.get(cacheKey));
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const cacheKey = `supp_${personInfo.personId}_${personInfo.age}_${personInfo.gender}_${personInfo.riskGroup}`;
        if (!cache.has(cacheKey)) {
            cache.set(cacheKey, calculateSupplementaryFee(personInfo));
        }
        updateSupplementaryFeeDisplay(container, personInfo);
        totalFee += cache.get(cacheKey);
    });

    document.getElementById('total-fee').textContent = formatCurrency(totalFee);
}

function handleEdgeCases() {
    const mainPersonContainer = document.getElementById('main-person-container');
    const mainPersonInfo = getCustomerInfo(mainPersonContainer, true);
    
    // Handle empty or invalid main product
    if (!mainPersonInfo.mainProduct) {
        showFieldError(document.getElementById('main-product').parentElement.querySelector('.error-message'), 
            'Vui lòng chọn sản phẩm chính');
    }

    // Handle invalid STBH for main product
    const mainSTBHInput = document.getElementById('main-stbh');
    if (mainSTBHInput && parseFormattedNumber(mainSTBHInput.value) <= 0) {
        showFieldError(mainSTBHInput.parentElement.querySelector('.error-message'), 
            'Số tiền bảo hiểm phải lớn hơn 0');
    }

    // Handle supplementary products with no selection
    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppProducts = ['health-scl', 'bhn', 'accident', 'hospital-support', 'waiver-premium'];
        let hasSelection = false;
        
        suppProducts.forEach(product => {
            if (container.querySelector(`.${product}-checkbox`)?.checked) {
                hasSelection = true;
                const stbhInput = container.querySelector(`.${product}-stbh`);
                if (stbhInput && parseFormattedNumber(stbhInput.value) <= 0) {
                    showFieldError(stbhInput.parentElement.querySelector('.error-message'), 
                        `Số tiền bảo hiểm cho ${product} phải lớn hơn 0`);
                }
            }
        });

        if (!hasSelection && container.dataset.personId !== 'main') {
            showFieldError(container.querySelector('.error-message'), 
                'Vui lòng chọn ít nhất một sản phẩm bổ sung');
        }
    });
}

function updateDynamicValidation() {
    document.querySelectorAll('.person-container').forEach(container => {
        const inputs = container.querySelectorAll('.form-input, .form-select');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                validateInput(input);
                handleErrorSummary();
                optimizeFeeCalculation();
            });
        });
    });
}

function generateDetailedSummary() {
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    let summaryHtml = '<div class="detailed-summary">';
    
    if (mainPersonInfo.mainProduct) {
        const mainFee = calculateMainProductFee(mainPersonInfo);
        summaryHtml += `
            <h3 class="text-lg font-bold text-gray-700">Người được bảo hiểm chính: ${mainPersonInfo.name}</h3>
            <p><strong>Sản phẩm:</strong> ${mainPersonInfo.mainProduct}</p>
            <p><strong>Phí bảo hiểm:</strong> ${formatCurrency(mainFee)}</p>
        `;
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppFee = calculateSupplementaryFee(personInfo);
        if (suppFee > 0) {
            summaryHtml += `
                <h3 class="text-lg font-bold text-gray-700 mt-4">Người được bảo hiểm bổ sung: ${personInfo.name}</h3>
                <p><strong>Sản phẩm bổ sung:</strong></p>
                ${generateProductSummary(personInfo, container)}
                <p><strong>Tổng phí bổ sung:</strong> ${formatCurrency(suppFee)}</p>
            `;
        }
    });

    summaryHtml += `
        <p class="font-bold mt-4">Lưu ý: Bảng minh họa này chỉ mang tính chất tham khảo và không thay thế hợp đồng bảo hiểm chính thức.</p>
        </div>
    `;
    
    const summaryTable = document.getElementById('summary-table');
    summaryTable.innerHTML = summaryHtml;
    document.getElementById('summary-modal').classList.remove('hidden');
}

function initializeDynamicListeners() {
    document.querySelectorAll('.person-container').forEach(container => {
        const inputs = container.querySelectorAll('.form-input, .form-select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                syncInputValues();
                updateDynamicValidation();
                optimizeFeeCalculation();
            });
        });
    });
}

// Final initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeDynamicListeners();
    updateDynamicValidation();
    document.getElementById('view-detailed-summary-btn')?.addEventListener('click', generateDetailedSummary);
    setTimeout(() => {
        optimizeFeeCalculation();
        handleEdgeCases();
    }, 0);
});
function sanitizeInput(value) {
    // Loại bỏ ký tự đặc biệt nguy hiểm cho HTML và LaTeX
    return value.replace(/[&<>"'\\]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '\\': '\\textbackslash{}'
    }[char] || char));
}

function handleNetworkErrors() {
    // Kiểm tra tải data.js và logo
    if (!product_data || !product_data.pul_rates || !product_data.occupations) {
        showFieldError(document.getElementById('error-summary'), 
            'Lỗi tải dữ liệu sản phẩm. Vui lòng kiểm tra kết nối mạng và thử lại.');
        return false;
    }
    const logoImg = new Image();
    logoImg.src = '/assets/aia-logo.png';
    logoImg.onerror = () => {
        showFieldError(document.getElementById('error-summary'), 
            'Không thể tải logo AIA. Vui lòng kiểm tra đường dẫn tài nguyên.');
    };
    return true;
}

function optimizeDynamicRendering() {
    // Tối ưu hiển thị khi có nhiều người được bảo hiểm
    const suppContainers = document.querySelectorAll('#supplementary-insured-container .person-container');
    if (suppContainers.length > 10) {
        suppContainers.forEach(container => {
            container.classList.add('transition-all', 'duration-300');
        });
    }
}

function validateFormBeforeSubmit() {
    const isValid = validateAllInputs();
    if (!isValid) {
        handleErrorSummary();
        return false;
    }
    if (!handleNetworkErrors()) {
        return false;
    }
    return true;
}

function updateGlobalState() {
    // Cập nhật trạng thái toàn cục để theo dõi các thay đổi
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    currentMainProductState = {
        product: mainPersonInfo.mainProduct,
        age: mainPersonInfo.age,
        gender: mainPersonInfo.gender
    };
    
    // Cập nhật số lượng người được bảo hiểm bổ sung
    supplementaryInsuredCount = document.querySelectorAll('#supplementary-insured-container .person-container').length;
}

function generateCompactSummary() {
    // Tạo phiên bản tóm tắt cho giao diện mobile
    const mainPersonInfo = getCustomerInfo(document.getElementById('main-person-container'), true);
    let summaryHtml = '<div class="compact-summary space-y-2">';
    
    if (mainPersonInfo.mainProduct) {
        const mainFee = calculateMainProductFee(mainPersonInfo);
        summaryHtml += `
            <p><strong>${sanitizeInput(mainPersonInfo.name)}:</strong> ${mainPersonInfo.mainProduct} - ${formatCurrency(mainFee)}</p>
        `;
    }

    document.querySelectorAll('.person-container').forEach(container => {
        const personInfo = getCustomerInfo(container, container.dataset.personId === 'main');
        const suppFee = calculateSupplementaryFee(personInfo);
        if (suppFee > 0) {
            summaryHtml += `
                <p><strong>${sanitizeInput(personInfo.name)}:</strong> Sản phẩm bổ sung - ${formatCurrency(suppFee)}</p>
            `;
        }
    });

    summaryHtml += '</div>';
    const compactSummary = document.getElementById('compact-summary');
    if (compactSummary) {
        compactSummary.innerHTML = summaryHtml;
    }
}

// Final initialization with error handling
document.addEventListener('DOMContentLoaded', () => {
    if (!handleNetworkErrors()) {
        return;
    }
    
    optimizeDynamicRendering();
    updateGlobalState();
    document.getElementById('submit-form-btn')?.addEventListener('click', () => {
        if (validateFormBeforeSubmit()) {
            generateDetailedSummary();
            generateCompactSummary();
        }
    });
    
    // Thêm sự kiện resize để tối ưu giao diện mobile
    window.addEventListener('resize', () => {
        optimizeDynamicRendering();
        generateCompactSummary();
    });
});
