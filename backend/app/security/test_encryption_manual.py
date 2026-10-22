from app.security.encryption import encrypt_secret, decrypt_secret

# 1. Create a sample secret
original_secret = "My test password"

# 2. Encrypt the secret
ciphertext, nonce = encrypt_secret(original_secret)

# 3. Display the results
print("Original secret:", original_secret)
print("Ciphertext:", ciphertext)
print("Nonce:", nonce)

# 4. Decrypt the secret
decrypted_secret = decrypt_secret(ciphertext, nonce)

print("Decrypted secret:", decrypted_secret)

# 5. Check whether the test passed
if decrypted_secret == original_secret:
    print("Encryption and decryption test passed.")
else:
    print("Encryption and decryption test failed.")