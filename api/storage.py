"""
OCI Object Storage client (S3-compatible).
"""
import boto3
from botocore.config import Config as BotoConfig

from api.config import get_settings

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    settings = get_settings()
    endpoint_url = (
        f"https://{settings.oci_namespace}.compat.objectstorage"
        f".{settings.oci_region}.oraclecloud.com"
    )
    _s3_client = boto3.client(
        "s3",
        region_name=settings.oci_region,
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.oci_access_key,
        aws_secret_access_key=settings.oci_secret_key,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    return _s3_client


def upload_file_to_oci(
    file_data: bytes,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload bytes to OCI Object Storage and return the object key."""
    client = _get_s3_client()
    settings = get_settings()

    client.put_object(
        Bucket=settings.oci_bucket_name,
        Key=object_key,
        Body=file_data,
        ContentType=content_type,
    )
    return object_key
