<script lang="ts">
    import CenteredWindow from "./CenteredWindow.svelte";

    export let modalityValue: DICOMModality;
    export let submit;
    export let editMode: boolean = false;
    export let showServerForm: boolean = false;

    let centeredWindowHeader = "Add a DICOM modality";
    let submitText = "Add modality";
    if (editMode) {
        centeredWindowHeader = "Edit DICOM modality";
        submitText = "Apply changes to DICOM modality";
    }
    
</script>

<CenteredWindow bind:showModal={showServerForm} header={centeredWindowHeader}>
    <div slot="form">
        <form on:submit|preventDefault={submit}>
            <div class="mb-3">
                <label for="aet" class="form-label fs-5">Application Entity Title (AET):</label>
                <input bind:value={modalityValue.aet} type="text" class="form-control rounded-3" id="aet" placeholder="Ex: CARDIOLOGY_1" maxlength="16" required>
            </div>
            <div class="mb-3">
                <label for="ip" class="form-label fs-5">IP address:</label>
                <input bind:value={modalityValue.ip} type="text" class="form-control rounded-3" id="ip" placeholder="Ex: 192.168.129.96" maxlength="39" required>
            </div>
            <div class="mb-3">
                <label for="publishedPortDicom" class="form-label fs-7">Port DICOM:</label>
                <input bind:value={modalityValue.publishedPortDicom} type="text" class="form-control rounded-3" id="publishedPortDicom" placeholder="Ex: 104" pattern="\d+" required>
            </div>
            <div class="mb-3">
                <label for="description" class="form-label fs-5">Description:</label>
                <textarea bind:value={modalityValue.description} class="form-control rounded-3" id="description" maxlength="200" rows="4" required></textarea>
            </div>
            
            <button class="w-100 mb-2 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="submit">{submitText}</button>
        </form>	
    </div>
</CenteredWindow>