import bcrypt

# replace with the hash you posted
stored_hash = "$2b$12$o9FOK1jKkV/O/vz4vmcehu8x/Epv3G36bQTTirsyZ/QLM7Ek8rQha"

# replace with the password you want to test
candidate = "admin123".encode()

if bcrypt.checkpw(candidate, stored_hash.encode()):
    print("MATCH: candidate password is correct")
else:
    print("NO MATCH: candidate password is incorrect")
