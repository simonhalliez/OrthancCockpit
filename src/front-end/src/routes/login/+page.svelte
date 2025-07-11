<script>
    import { goto } from "$app/navigation";
	import { env } from "$env/dynamic/public";
	import { connectedUser } from "../../store/connectedUser";
	import axios from "axios";
	import { alertMessage, alertType } from '../../store/alert';

	
	const baseUrl = env.PUBLIC_BASE_URL;

	let username = '';
	let password = '';

    function handleOnSubmit() {
		axios.post(`${baseUrl}/login`, {username: username,password: password})
		.then( (res) => {
			connectedUser.set({ isLogged: true, token: res.data.token });
			goto('/');
		}).catch((error) => {
			alertType.set('danger');
			alertMessage.set(error.response.data.message || 'An error occurred during login');
		});
	}

</script>

<form method="POST" on:submit|preventDefault={handleOnSubmit}>
	<div class="container py-5 h-100">
		<div class="row d-flex justify-content-center align-items-center h-100">
			<div class="col-12 col-md-8 col-lg-6 col-xl-5">
				<div class="card shadow-2-strong" style="border-radius: 1rem;">
					<div class="card-body p-5 text-center">
						<h3 class="mb-5">Sign in</h3>
						
						<div class="form-outline mb-4">
							<label class="form-label" for="username">Username</label>
							<input bind:value={username} id="username" type="text" class="form-control form-control-lg" placeholder="Ex: Pierre.Hullis"/>
							
						</div>

						<div class="form-outline mb-4">
							<label class="form-label" for="password">Password</label>
							<input
								bind:value={password}
								type="password"
								id="password"
								class="form-control form-control-lg"
								placeholder="Enter the admin password"
							/>
							
						</div>

						<button class="btn btn-primary btn-lg btn-block" type="submit">Login</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</form>